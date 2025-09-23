import csv
from datetime import date
from io import StringIO
from typing import List, Optional

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff_group import TariffGroup
from app.models.tour import Tour
from app.models.tour_item import TourItem
from app.schemas.tour import DeclarationReportLine, DeclarationReportUpdate


router = APIRouter(prefix="/reports", tags=["reports"])


def _serialize_declaration(
    item: TourItem,
    tour: Tour,
    driver: Chauffeur,
    client: Client,
    tg: TariffGroup,
) -> DeclarationReportLine:
    pickup_qty = item.pickup_quantity or 0
    delivery_qty = item.delivery_quantity or 0
    return DeclarationReportLine(
        tour_id=tour.id,
        tour_item_id=item.id,
        date=tour.date,
        driver_name=driver.display_name,
        client_name=client.name,
        tariff_group_display_name=tg.display_name,
        pickup_quantity=pickup_qty,
        delivery_quantity=delivery_qty,
        difference_quantity=pickup_qty - delivery_qty,
        estimated_amount_eur=item.amount_ex_vat_snapshot or Decimal("0"),
    )


def _query_declarations(
    db: Session,
    tenant_id: int,
    date_from: Optional[date],
    date_to: Optional[date],
    client_id: Optional[int],
    driver_id: Optional[int],
) -> List[DeclarationReportLine]:
    query = (
        db.query(TourItem, Tour, Chauffeur, Client, TariffGroup)
        .join(Tour, TourItem.tour_id == Tour.id)
        .join(Chauffeur, Tour.driver_id == Chauffeur.id)
        .join(Client, Tour.client_id == Client.id)
        .join(TariffGroup, TourItem.tariff_group_id == TariffGroup.id)
        .filter(Tour.tenant_id == tenant_id)
        .filter(Tour.status == Tour.STATUS_COMPLETED)
    )

    if date_from:
        query = query.filter(Tour.date >= date_from)
    if date_to:
        query = query.filter(Tour.date <= date_to)
    if client_id:
        query = query.filter(Tour.client_id == client_id)
    if driver_id:
        query = query.filter(Tour.driver_id == driver_id)

    query = query.order_by(Tour.date.desc())

    rows = []
    for item, tour, driver, client, tg in query.all():
        rows.append(_serialize_declaration(item, tour, driver, client, tg))
    return rows


def _get_single_declaration(
    db: Session, tenant_id: int, tour_item_id: int
) -> tuple[TourItem, Tour, Chauffeur, Client, TariffGroup] | None:
    return (
        db.query(TourItem, Tour, Chauffeur, Client, TariffGroup)
        .join(Tour, TourItem.tour_id == Tour.id)
        .join(Chauffeur, Tour.driver_id == Chauffeur.id)
        .join(Client, Tour.client_id == Client.id)
        .join(TariffGroup, TourItem.tariff_group_id == TariffGroup.id)
        .filter(Tour.tenant_id == tenant_id)
        .filter(TourItem.id == tour_item_id)
        .first()
    )


@router.get(
    "/declarations/",
    response_model=List[DeclarationReportLine],
    include_in_schema=False,
)
@router.get("/declarations", response_model=List[DeclarationReportLine])
def report_declarations(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    client_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    return _query_declarations(db, tenant_id_int, date_from, date_to, client_id, driver_id)


@router.put(
    "/declarations/{tour_item_id}",
    response_model=DeclarationReportLine,
)
@router.put(
    "/declarations/{tour_item_id}/",
    response_model=DeclarationReportLine,
    include_in_schema=False,
)
def update_declaration(
    tour_item_id: int,
    declaration_update: DeclarationReportUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    declaration = _get_single_declaration(db, tenant_id_int, tour_item_id)
    if declaration is None:
        raise HTTPException(status_code=404, detail="Declaration not found")

    item, tour, driver, client, tg = declaration

    new_pickup = (
        declaration_update.pickup_quantity
        if declaration_update.pickup_quantity is not None
        else item.pickup_quantity or 0
    )
    new_delivery = (
        declaration_update.delivery_quantity
        if declaration_update.delivery_quantity is not None
        else item.delivery_quantity or 0
    )

    if new_delivery > new_pickup:
        raise HTTPException(
            status_code=400,
            detail="Delivered quantity cannot exceed picked up quantity",
        )

    if declaration_update.pickup_quantity is not None:
        item.pickup_quantity = declaration_update.pickup_quantity
    if declaration_update.delivery_quantity is not None:
        item.delivery_quantity = declaration_update.delivery_quantity

    if declaration_update.estimated_amount_eur is not None:
        item.amount_ex_vat_snapshot = declaration_update.estimated_amount_eur
    elif declaration_update.delivery_quantity is not None:
        unit_price = item.unit_price_ex_vat_snapshot or Decimal("0")
        item.amount_ex_vat_snapshot = unit_price * (
            item.delivery_quantity or 0
        )

    db.commit()

    updated = _get_single_declaration(db, tenant_id_int, tour_item_id)
    if updated is None:
        raise HTTPException(status_code=404, detail="Declaration not found")
    item, tour, driver, client, tg = updated
    return _serialize_declaration(item, tour, driver, client, tg)


@router.delete("/declarations/{tour_item_id}", status_code=204)
@router.delete(
    "/declarations/{tour_item_id}/",
    status_code=204,
    include_in_schema=False,
)
def delete_declaration(
    tour_item_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    declaration = _get_single_declaration(db, tenant_id_int, tour_item_id)
    if declaration is None:
        raise HTTPException(status_code=404, detail="Declaration not found")

    item, tour, *_ = declaration
    db.delete(item)
    db.flush()

    remaining = (
        db.query(TourItem)
        .filter(TourItem.tour_id == tour.id, TourItem.tenant_id == tenant_id_int)
        .count()
    )
    if remaining == 0:
        db.delete(tour)

    db.commit()


@router.get("/declarations/export.csv/", include_in_schema=False)
@router.get("/declarations/export.csv")
def report_declarations_csv(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    client_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    rows = _query_declarations(
        db, tenant_id_int, date_from, date_to, client_id, driver_id
    )
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(
        [
            "Date",
            "Chauffeur",
            "Client donneur d'ordre",
            "Catégorie de groupe tarifaire",
            "Nombre de colis récupérés",
            "Nombre de colis livrés",
            "Écart",
            "Montant estimé (€)",
        ]
    )
    for r in rows:
        writer.writerow(
            [
                r.date.isoformat(),
                r.driver_name,
                r.client_name,
                r.tariff_group_display_name,
                r.pickup_quantity,
                r.delivery_quantity,
                r.difference_quantity,
                f"{r.estimated_amount_eur:.2f}",
            ]
        )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=declarations.csv"},
    )
