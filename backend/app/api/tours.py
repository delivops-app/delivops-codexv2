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
from app.schemas.tour import TourCreate, TourRead, TourItemRead, TourTotals


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


@router.post("", response_model=TourRead, status_code=201, include_in_schema=False)
@router.post("/", response_model=TourRead, status_code=201)
def create_tour(
    tour_in: TourCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    driver = _get_driver_from_user(db, tenant_id_int, user.get("sub"))

    client = db.get(Client, tour_in.client_id)
    if client is None or client.tenant_id != tenant_id_int:
        raise HTTPException(status_code=404, detail="Client not found")

    tour = Tour(
        tenant_id=tenant_id_int,
        driver_id=driver.id,
        client_id=client.id,
        date=tour_in.date,
        kind=tour_in.kind,
    )
    db.add(tour)
    db.flush()

    items_read: list[TourItemRead] = []
    total_qty = 0
    total_amount = Decimal("0")
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
        amount = unit_price * item.quantity

        ti = TourItem(
            tenant_id=tenant_id_int,
            tour_id=tour.id,
            tariff_group_id=tg.id,
            quantity=item.quantity,
            unit_price_ex_vat_snapshot=unit_price,
            amount_ex_vat_snapshot=amount,
        )
        db.add(ti)

        items_read.append(
            TourItemRead(
                tariff_group_id=tg.id,
                display_name=tg.display_name,
                quantity=item.quantity,
                unit_price_ex_vat=unit_price,
                amount_ex_vat=amount,
            )
        )
        total_qty += item.quantity
        total_amount += amount

    db.commit()

    return TourRead(
        tour_id=tour.id,
        date=tour.date,
        driver={"id": driver.id, "name": driver.display_name},
        client={"id": client.id, "name": client.name},
        items=items_read,
        totals=TourTotals(qty=total_qty, amount_ex_vat=total_amount),
    )

