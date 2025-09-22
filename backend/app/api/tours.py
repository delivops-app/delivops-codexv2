from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
from app.models.tour import Tour
from app.models.tour_item import TourItem
from app.models.user import User
from app.schemas.tour import (
    TourDeliveryUpdate,
    TourItemRead,
    TourPickupCreate,
    TourRead,
    TourTotals,
)


router = APIRouter(prefix="/tours", tags=["tours"])


def _get_driver_from_user(db: Session, tenant_id: int, user_sub: str) -> Chauffeur:
    user = (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.auth0_sub == user_sub)
        .first()
    )
    if not user or user.role != "CHAUFFEUR":
        raise HTTPException(status_code=403, detail="Driver not found")
    chauffeur = db.query(Chauffeur).filter(Chauffeur.user_id == user.id).first()
    if chauffeur is None:
        raise HTTPException(status_code=403, detail="Driver not found")
    return chauffeur


def _serialize_tour(tour: Tour) -> TourRead:
    driver = tour.driver
    client = tour.client

    items_read: list[TourItemRead] = []
    total_pickup = 0
    total_delivery = 0
    total_amount = Decimal("0")

    # Keep a deterministic order for readability
    sorted_items = sorted(
        tour.items,
        key=lambda item: item.tariff_group.display_name
        if item.tariff_group
        else item.tariff_group_id,
    )

    for item in sorted_items:
        pickup_qty = item.pickup_quantity or 0
        delivery_qty = item.delivery_quantity or 0
        diff = pickup_qty - delivery_qty
        unit_price = item.unit_price_ex_vat_snapshot or Decimal("0")
        amount = item.amount_ex_vat_snapshot or Decimal("0")

        items_read.append(
            TourItemRead(
                tariff_group_id=item.tariff_group_id,
                display_name=item.tariff_group.display_name
                if item.tariff_group
                else str(item.tariff_group_id),
                pickup_quantity=pickup_qty,
                delivery_quantity=delivery_qty,
                difference=diff,
                unit_price_ex_vat=unit_price,
                amount_ex_vat=amount,
            )
        )
        total_pickup += pickup_qty
        total_delivery += delivery_qty
        total_amount += amount

    totals = TourTotals(
        pickup_qty=total_pickup,
        delivery_qty=total_delivery,
        difference_qty=total_pickup - total_delivery,
        amount_ex_vat=total_amount,
    )

    return TourRead(
        tour_id=tour.id,
        date=tour.date,
        status=tour.status,
        driver={"id": driver.id, "name": driver.display_name},
        client={"id": client.id, "name": client.name},
        items=items_read,
        totals=totals,
    )


@router.post("/pickup", response_model=TourRead, status_code=201)
@router.post("/pickup/", response_model=TourRead, status_code=201, include_in_schema=False)
def create_tour_pickup(
    tour_in: TourPickupCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    driver = _get_driver_from_user(db, tenant_id_int, user.get("sub"))

    client = db.get(Client, tour_in.client_id)
    if client is None or client.tenant_id != tenant_id_int:
        raise HTTPException(status_code=404, detail="Client not found")

    if not tour_in.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    tour = Tour(
        tenant_id=tenant_id_int,
        driver_id=driver.id,
        client_id=client.id,
        date=tour_in.date,
        status=Tour.STATUS_IN_PROGRESS,
    )
    db.add(tour)
    db.flush()

    for item in tour_in.items:
        tg = db.get(TariffGroup, item.tariff_group_id)
        if tg is None or tg.tenant_id != tenant_id_int:
            raise HTTPException(status_code=404, detail="Tariff group not found")
        if tg.client_id is not None and tg.client_id != client.id:
            raise HTTPException(
                status_code=400,
                detail="Tariff group not available for this client",
            )
        tariff = (
            db.query(Tariff)
            .filter(
                Tariff.tariff_group_id == tg.id,
                Tariff.effective_from <= tour_in.date,
                (Tariff.effective_to.is_(None)) | (Tariff.effective_to >= tour_in.date),
            )
            .order_by(Tariff.effective_from.desc())
            .first()
        )
        unit_price = tariff.price_ex_vat if tariff else Decimal("0")

        tour_item = TourItem(
            tenant_id=tenant_id_int,
            tour_id=tour.id,
            tariff_group_id=tg.id,
            pickup_quantity=item.pickup_quantity,
            delivery_quantity=0,
            unit_price_ex_vat_snapshot=unit_price,
            amount_ex_vat_snapshot=Decimal("0"),
        )
        db.add(tour_item)

    db.commit()
    db.refresh(tour)

    return _serialize_tour(tour)


@router.get("/pending", response_model=list[TourRead])
@router.get("/pending/", response_model=list[TourRead], include_in_schema=False)
def list_pending_tours(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    driver = _get_driver_from_user(db, tenant_id_int, user.get("sub"))

    tours = (
        db.query(Tour)
        .filter(
            Tour.tenant_id == tenant_id_int,
            Tour.driver_id == driver.id,
            Tour.status == Tour.STATUS_IN_PROGRESS,
        )
        .order_by(Tour.date)
        .all()
    )

    return [_serialize_tour(t) for t in tours]


@router.put("/{tour_id}/delivery", response_model=TourRead)
@router.put(
    "/{tour_id}/delivery/",
    response_model=TourRead,
    include_in_schema=False,
)
def submit_tour_delivery(
    tour_id: int,
    tour_update: TourDeliveryUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    driver = _get_driver_from_user(db, tenant_id_int, user.get("sub"))

    tour = db.get(Tour, tour_id)
    if tour is None or tour.tenant_id != tenant_id_int:
        raise HTTPException(status_code=404, detail="Tour not found")
    if tour.driver_id != driver.id:
        raise HTTPException(status_code=403, detail="Tour not owned by driver")
    if tour.status != Tour.STATUS_IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Tour already completed")

    if not tour_update.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    items_by_group = {item.tariff_group_id: item for item in tour.items}
    updated_groups: set[int] = set()

    for item in tour_update.items:
        ti = items_by_group.get(item.tariff_group_id)
        if ti is None:
            raise HTTPException(status_code=400, detail="Unknown tariff group")
        if item.delivery_quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity cannot be negative")
        if item.delivery_quantity > ti.pickup_quantity:
            raise HTTPException(
                status_code=400,
                detail="Delivered quantity cannot exceed picked up quantity",
            )
        updated_groups.add(item.tariff_group_id)
        ti.delivery_quantity = item.delivery_quantity
        ti.amount_ex_vat_snapshot = (
            ti.unit_price_ex_vat_snapshot or Decimal("0")
        ) * item.delivery_quantity

    # Any item not referenced in the payload is considered undelivered
    for tg_id, ti in items_by_group.items():
        if tg_id not in updated_groups:
            ti.delivery_quantity = 0
            ti.amount_ex_vat_snapshot = Decimal("0")

    tour.status = Tour.STATUS_COMPLETED
    db.commit()
    db.refresh(tour)

    return _serialize_tour(tour)
