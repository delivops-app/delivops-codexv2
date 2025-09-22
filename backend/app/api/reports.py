import csv
from datetime import date
from io import StringIO
from typing import List, Optional

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tour import Tour
from app.models.tour_item import TourItem
from app.models.tariff_group import TariffGroup
from app.schemas.tour import DeclarationReportLine


router = APIRouter(prefix="/reports", tags=["reports"])


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
        .filter(Tour.kind == "DELIVERY")
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
        rows.append(
            DeclarationReportLine(
                date=tour.date,
                driver_name=driver.display_name,
                client_name=client.name,
                tariff_group_display_name=tg.display_name,
                quantity=item.quantity,
                estimated_amount_eur=item.amount_ex_vat_snapshot,
            )
        )
    return rows


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
            "Nombre de colis livrés",
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
                r.quantity,
                f"{r.estimated_amount_eur:.2f}",
            ]
        )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=declarations.csv"},
    )

