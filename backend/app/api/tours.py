from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_tenant_id, require_roles, require_tenant_roles
from app.db.session import get_db
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
from app.models.tour import Tour
from app.models.tour_item import TourItem
from app.models.user import User
from app.schemas.tour import (
    TourActivityInProgress,
    TourActivitySummary,
    TourDeliveryUpdate,
    TourItemRead,
    TourPickupCreate,
    TourRead,
    TourTotals,
)

router = APIRouter(prefix="/tours", tags=["tours"])


@router.get("/activity-summary", response_model=TourActivitySummary)
def list_tour_activity_summary(
    start_date: date | None = Query(default=None, alias="startDate"),
    end_date: date | None = Query(default=None, alias="endDate"),
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    _: dict = Depends(require_tenant_roles("ADMIN")),  # noqa: B008
):
    today = date.today()
    period_start = start_date or today
    period_end = end_date or period_start

    if period_start > period_end:
        raise HTTPException(status_code=400, detail="Invalid date range")

    tours = (
        db.query(Tour)
        .filter(
            Tour.tenant_id == tenant_id,
            Tour.date >= period_start,
            Tour.date <= period_end,
        )
        .options(
            joinedload(Tour.driver),
            joinedload(Tour.client),
            selectinload(Tour.items),
        )
        .all()
    )

    in_progress: list[TourActivityInProgress] = []
    closed_count = 0
    return_total = 0

    for tour in tours:
        pickup_total = sum((item.pickup_quantity or 0) for item in tour.items)
        delivery_total = sum((item.delivery_quantity or 0) for item in tour.items)

        if tour.status == Tour.STATUS_IN_PROGRESS:
            in_progress.append(
                TourActivityInProgress(
                    tour_id=tour.id,
                    date=tour.date,
                    driver_name=(tour.driver.display_name if tour.driver else "—"),
                    client_name=(tour.client.name if tour.client else "—"),
                    total_pickup=pickup_total,
                    total_delivery=delivery_total,
                )
            )
        elif tour.status == Tour.STATUS_COMPLETED:
            closed_count += 1
            if pickup_total > delivery_total:
                return_total += pickup_total - delivery_total

    in_progress.sort(key=lambda tour_summary: (tour_summary.date, tour_summary.tour_id))

    return TourActivitySummary(
        in_progress=in_progress,
        closed_count=closed_count,
        return_count=return_total,
    )


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
    chauffeur.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(chauffeur)
    return chauffeur


def _serialize_tour(tour: Tour) -> TourRead:
    driver = tour.driver
    client = tour.client

    items_read: list[TourItemRead] = []
    total_pickup = 0
    total_delivery = 0
    total_amount = Decimal("0")
    total_margin = Decimal("0")

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
        unit_margin = item.unit_margin_ex_vat_snapshot or Decimal("0")
        margin_amount = item.margin_ex_vat_snapshot or Decimal("0")

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
                unit_margin_ex_vat=unit_margin,
                margin_amount_ex_vat=margin_amount,
            )
        )
        total_pickup += pickup_qty
        total_delivery += delivery_qty
        total_amount += amount
        total_margin += margin_amount

    totals = TourTotals(
        pickup_qty=total_pickup,
        delivery_qty=total_delivery,
        difference_qty=total_pickup - total_delivery,
        amount_ex_vat=total_amount,
        margin_amount_ex_vat=total_margin,
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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    driver = _get_driver_from_user(db, tenant_id, user.get("sub"))

    client = db.get(Client, tour_in.client_id)
    if client is None or client.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Client not found")

    if not tour_in.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    tour = Tour(
        tenant_id=tenant_id,
        driver_id=driver.id,
        client_id=client.id,
        date=tour_in.date,
        status=Tour.STATUS_IN_PROGRESS,
    )
    db.add(tour)
    db.flush()

    for item in tour_in.items:
        tg = db.get(TariffGroup, item.tariff_group_id)
        if tg is None or tg.tenant_id != tenant_id:
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
        unit_margin = tariff.margin_ex_vat if tariff else Decimal("0")

        tour_item = TourItem(
            tenant_id=tenant_id,
            tour_id=tour.id,
            tariff_group_id=tg.id,
            pickup_quantity=item.pickup_quantity,
            delivery_quantity=0,
            unit_price_ex_vat_snapshot=unit_price,
            amount_ex_vat_snapshot=Decimal("0"),
            unit_margin_ex_vat_snapshot=unit_margin,
            margin_ex_vat_snapshot=Decimal("0"),
        )
        db.add(tour_item)

    db.commit()
    db.refresh(tour)

    return _serialize_tour(tour)


@router.get("/pending", response_model=list[TourRead])
@router.get("/pending/", response_model=list[TourRead], include_in_schema=False)
def list_pending_tours(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    driver = _get_driver_from_user(db, tenant_id, user.get("sub"))

    tours = (
        db.query(Tour)
        .filter(
            Tour.tenant_id == tenant_id,
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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    driver = _get_driver_from_user(db, tenant_id, user.get("sub"))

    tour = db.get(Tour, tour_id)
    if tour is None or tour.tenant_id != tenant_id:
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
        ti.margin_ex_vat_snapshot = (
            ti.unit_margin_ex_vat_snapshot or Decimal("0")
        ) * item.delivery_quantity

    # Any item not referenced in the payload is considered undelivered
    for tg_id, ti in items_by_group.items():
        if tg_id not in updated_groups:
            ti.delivery_quantity = 0
            ti.amount_ex_vat_snapshot = Decimal("0")
            ti.margin_ex_vat_snapshot = Decimal("0")

    tour.status = Tour.STATUS_COMPLETED
    db.commit()
    db.refresh(tour)

    return _serialize_tour(tour)
