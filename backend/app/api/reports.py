import csv
from datetime import date
from io import BytesIO, StringIO
from typing import List, Optional

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
from app.models.tour import Tour
from app.models.tour_item import TourItem
from openpyxl import Workbook
from app.schemas.tour import (
    DeclarationReportCreate,
    DeclarationReportLine,
    DeclarationReportUpdate,
)


router = APIRouter(prefix="/reports", tags=["reports"])


DECLARATIONS_EXPORT_HEADER = [
    "Date",
    "Chauffeur",
    "Client donneur d'ordre",
    "Catégorie de groupe tarifaire",
    "Nombre de colis récupérés",
    "Nombre de colis livrés",
    "Écart",
    "Montant estimé (€)",
    "Marge (€)",
]


def _format_declaration_export_row(
    declaration: DeclarationReportLine,
) -> list[str | int]:
    return [
        declaration.date.isoformat(),
        declaration.driver_name,
        declaration.client_name,
        declaration.tariff_group_display_name,
        declaration.pickup_quantity,
        declaration.delivery_quantity,
        declaration.difference_quantity,
        f"{declaration.estimated_amount_eur:.2f}",
        f"{declaration.margin_amount_eur:.2f}",
    ]


def _serialize_declaration(
    item: TourItem | None,
    tour: Tour,
    driver: Chauffeur,
    client: Client,
    tg: TariffGroup | None,
) -> DeclarationReportLine:
    pickup_qty = item.pickup_quantity or 0 if item else 0
    delivery_qty = item.delivery_quantity or 0 if item else 0
    estimated_amount = (
        item.amount_ex_vat_snapshot if item and item.amount_ex_vat_snapshot else None
    )
    unit_price = (
        item.unit_price_ex_vat_snapshot if item and item.unit_price_ex_vat_snapshot else None
    )
    unit_margin = (
        item.unit_margin_ex_vat_snapshot if item and item.unit_margin_ex_vat_snapshot else None
    )
    margin_amount = (
        item.margin_ex_vat_snapshot if item and item.margin_ex_vat_snapshot else None
    )
    estimated_amount_value = (estimated_amount or Decimal("0")).quantize(
        Decimal("0.01")
    )
    unit_price_value = (unit_price or Decimal("0")).quantize(Decimal("0.01"))
    unit_margin_value = (unit_margin or Decimal("0")).quantize(Decimal("0.01"))
    margin_amount_value = (margin_amount or Decimal("0")).quantize(
        Decimal("0.01")
    )
    return DeclarationReportLine(
        tour_id=tour.id,
        tour_item_id=item.id if item else None,
        date=tour.date,
        driver_name=driver.display_name,
        client_name=client.name,
        tariff_group_display_name=tg.display_name if tg else "—",
        pickup_quantity=pickup_qty,
        delivery_quantity=delivery_qty,
        difference_quantity=pickup_qty - delivery_qty,
        estimated_amount_eur=estimated_amount_value,
        unit_price_ex_vat=unit_price_value,
        unit_margin_ex_vat=unit_margin_value,
        margin_amount_eur=margin_amount_value,
        status=tour.status,
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
        db.query(Tour, TourItem, Chauffeur, Client, TariffGroup)
        .join(Chauffeur, Tour.driver_id == Chauffeur.id)
        .join(Client, Tour.client_id == Client.id)
        .outerjoin(TourItem, TourItem.tour_id == Tour.id)
        .outerjoin(TariffGroup, TourItem.tariff_group_id == TariffGroup.id)
        .filter(Tour.tenant_id == tenant_id)
        .filter(
            Tour.status.in_([Tour.STATUS_COMPLETED, Tour.STATUS_IN_PROGRESS])
        )
    )

    if date_from:
        query = query.filter(Tour.date >= date_from)
    if date_to:
        query = query.filter(Tour.date <= date_to)
    if client_id:
        query = query.filter(Tour.client_id == client_id)
    if driver_id:
        query = query.filter(Tour.driver_id == driver_id)

    query = query.order_by(Tour.date.desc(), Tour.id.desc(), TourItem.id.asc())

    rows = []
    for tour, item, driver, client, tg in query.all():
        rows.append(_serialize_declaration(item, tour, driver, client, tg))
    if len(rows) > 1:
        rows.sort(
            key=lambda r: (
                -r.date.toordinal(),
                -r.tour_id,
                r.tour_item_id if r.tour_item_id is not None else -1,
            )
        )
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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    return _query_declarations(db, tenant_id, date_from, date_to, client_id, driver_id)


@router.post(
    "/declarations",
    response_model=DeclarationReportLine,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/declarations/",
    response_model=DeclarationReportLine,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_declaration(
    declaration_create: DeclarationReportCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    driver = db.get(Chauffeur, declaration_create.driver_id)
    if driver is None or driver.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Driver not found")

    client = db.get(Client, declaration_create.client_id)
    if client is None or client.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Client not found")

    tg = db.get(TariffGroup, declaration_create.tariff_group_id)
    if tg is None or tg.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Tariff group not found")
    if tg.client_id not in (None, client.id):
        raise HTTPException(
            status_code=400,
            detail="Tariff group not available for this client",
        )

    if declaration_create.delivery_quantity > declaration_create.pickup_quantity:
        raise HTTPException(
            status_code=400,
            detail="Delivered quantity cannot exceed picked up quantity",
        )

    tour = (
        db.query(Tour)
        .filter(
            Tour.tenant_id == tenant_id,
            Tour.driver_id == driver.id,
            Tour.client_id == client.id,
            Tour.date == declaration_create.date,
        )
        .first()
    )

    if tour is None:
        tour = Tour(
            tenant_id=tenant_id,
            driver_id=driver.id,
            client_id=client.id,
            date=declaration_create.date,
            status=Tour.STATUS_COMPLETED,
        )
        db.add(tour)
        db.flush()
    else:
        existing_item = (
            db.query(TourItem)
            .filter(
                TourItem.tenant_id == tenant_id,
                TourItem.tour_id == tour.id,
                TourItem.tariff_group_id == tg.id,
            )
            .first()
        )
        if existing_item is not None:
            raise HTTPException(
                status_code=400,
                detail="A declaration already exists for this tariff group on this tour",
            )
        tour.status = Tour.STATUS_COMPLETED

    tariff = (
        db.query(Tariff)
        .filter(
            Tariff.tariff_group_id == tg.id,
            Tariff.effective_from <= declaration_create.date,
            (Tariff.effective_to.is_(None))
            | (Tariff.effective_to >= declaration_create.date),
        )
        .order_by(Tariff.effective_from.desc())
        .first()
    )
    unit_price = tariff.price_ex_vat if tariff else Decimal("0")
    unit_margin = tariff.margin_ex_vat if tariff else Decimal("0")

    amount = (
        declaration_create.estimated_amount_eur
        if declaration_create.estimated_amount_eur is not None
        else unit_price * declaration_create.delivery_quantity
    )
    margin_amount = unit_margin * declaration_create.delivery_quantity

    tour_item = TourItem(
        tenant_id=tenant_id,
        tour_id=tour.id,
        tariff_group_id=tg.id,
        pickup_quantity=declaration_create.pickup_quantity,
        delivery_quantity=declaration_create.delivery_quantity,
        unit_price_ex_vat_snapshot=unit_price,
        amount_ex_vat_snapshot=amount,
        unit_margin_ex_vat_snapshot=unit_margin,
        margin_ex_vat_snapshot=margin_amount,
    )
    db.add(tour_item)
    db.flush()
    db.commit()

    created = _get_single_declaration(db, tenant_id, tour_item.id)
    if created is None:
        raise HTTPException(status_code=404, detail="Declaration not found")
    item, tour, driver, client, tg = created
    return _serialize_declaration(item, tour, driver, client, tg)


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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    declaration = _get_single_declaration(db, tenant_id, tour_item_id)
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

    unit_margin = item.unit_margin_ex_vat_snapshot or Decimal("0")
    item.margin_ex_vat_snapshot = unit_margin * (item.delivery_quantity or 0)

    db.commit()

    updated = _get_single_declaration(db, tenant_id, tour_item_id)
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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    declaration = _get_single_declaration(db, tenant_id, tour_item_id)
    if declaration is None:
        raise HTTPException(status_code=404, detail="Declaration not found")

    item, tour, *_ = declaration
    db.delete(item)
    db.flush()

    remaining = (
        db.query(TourItem)
        .filter(TourItem.tour_id == tour.id, TourItem.tenant_id == tenant_id)
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
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    rows = _query_declarations(db, tenant_id, date_from, date_to, client_id, driver_id)
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(DECLARATIONS_EXPORT_HEADER)
    for r in rows:
        writer.writerow(_format_declaration_export_row(r))
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=declarations.csv"},
    )


@router.get("/declarations/export.xlsx/", include_in_schema=False)
@router.get("/declarations/export.xlsx")
def report_declarations_excel(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    client_id: Optional[int] = None,
    driver_id: Optional[int] = None,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    rows = _query_declarations(db, tenant_id, date_from, date_to, client_id, driver_id)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Declarations"
    sheet.append(DECLARATIONS_EXPORT_HEADER)
    for row in rows:
        sheet.append(_format_declaration_export_row(row))
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=declarations.xlsx"},
    )
