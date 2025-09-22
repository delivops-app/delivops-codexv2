from typing import List
import re

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
from app.models.tenant import Tenant
from app.schemas.client import (
    ClientWithCategories,
    CategoryRead,
    ClientCreate,
    ClientUpdate,
    CategoryCreate,
    CategoryUpdate,
)

router = APIRouter(prefix="/clients", tags=["clients"])


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


@router.get("", response_model=List[ClientWithCategories], include_in_schema=False)
@router.get("/", response_model=List[ClientWithCategories])
def list_clients(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR", "ADMIN")),  # noqa: B008
) -> List[ClientWithCategories]:
    """Return all active clients with their tariff categories."""
    tenant_id_int = int(tenant_id)
    clients = (
        db.execute(
            select(Client)
            .where(Client.tenant_id == tenant_id_int, Client.is_active.is_(True))
            .order_by(Client.name)
        )
        .scalars()
        .all()
    )

    today = date.today()
    result: List[ClientWithCategories] = []
    for client in clients:
        groups = (
            db.execute(
                select(TariffGroup)
                .where(
                    TariffGroup.tenant_id == tenant_id_int,
                    TariffGroup.client_id == client.id,
                    TariffGroup.is_active.is_(True),
                )
                .order_by(TariffGroup.order)
            )
            .scalars()
            .all()
        )
        categories: list[CategoryRead] = []
        for g in groups:
            tariff = (
                db.execute(
                    select(Tariff)
                    .where(
                        Tariff.tariff_group_id == g.id,
                        Tariff.effective_from <= today,
                        or_(Tariff.effective_to.is_(None), Tariff.effective_to >= today),
                    )
                    .order_by(Tariff.effective_from.desc())
                )
                .scalars()
                .first()
            )
            price = tariff.price_ex_vat if tariff else Decimal("0")
            categories.append(
                CategoryRead(id=g.id, name=g.display_name, unit_price_ex_vat=price)
            )
        result.append(
            ClientWithCategories(id=client.id, name=client.name, categories=categories)
        )
    return result


@router.post("", response_model=ClientWithCategories, status_code=201, include_in_schema=False)
@router.post("/", response_model=ClientWithCategories, status_code=201)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> ClientWithCategories:
    tenant_id_int = int(tenant_id)
    tenant = db.get(Tenant, tenant_id_int)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    client = Client(tenant_id=tenant_id_int, name=payload.name, is_active=True)
    db.add(client)
    db.commit()
    db.refresh(client)
    return ClientWithCategories(id=client.id, name=client.name, categories=[])


@router.patch("/{client_id}", response_model=ClientWithCategories)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> ClientWithCategories:
    tenant_id_int = int(tenant_id)
    client = db.execute(
        select(Client).where(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.name = payload.name
    db.commit()
    db.refresh(client)

    groups = (
        db.execute(
            select(TariffGroup)
            .where(
                TariffGroup.tenant_id == tenant_id_int,
                TariffGroup.client_id == client.id,
                TariffGroup.is_active.is_(True),
            )
            .order_by(TariffGroup.order)
        )
        .scalars()
        .all()
    )
    today = date.today()
    categories: list[CategoryRead] = []
    for g in groups:
        tariff = (
            db.execute(
                select(Tariff)
                .where(
                    Tariff.tariff_group_id == g.id,
                    Tariff.effective_from <= today,
                    or_(Tariff.effective_to.is_(None), Tariff.effective_to >= today),
                )
                .order_by(Tariff.effective_from.desc())
            )
            .scalars()
            .first()
        )
        price = tariff.price_ex_vat if tariff else Decimal("0")
        categories.append(
            CategoryRead(id=g.id, name=g.display_name, unit_price_ex_vat=price)
        )
    return ClientWithCategories(id=client.id, name=client.name, categories=categories)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> None:
    tenant_id_int = int(tenant_id)
    client = db.execute(
        select(Client).where(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    groups = (
        db.execute(
            select(TariffGroup).where(
                TariffGroup.tenant_id == tenant_id_int,
                TariffGroup.client_id == client.id,
                TariffGroup.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    for group in groups:
        group.is_active = False
    client.is_active = False
    db.commit()
    return None


@router.post("/{client_id}/categories", response_model=CategoryRead, status_code=201)
def create_category(
    client_id: int,
    payload: CategoryCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> CategoryRead:
    tenant_id_int = int(tenant_id)
    client = db.execute(
        select(Client).where(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    max_order = db.execute(
        select(func.max(TariffGroup.order)).where(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
        )
    ).scalar_one_or_none()
    order = (max_order + 1) if max_order is not None else 0
    group = TariffGroup(
        tenant_id=tenant_id_int,
        client_id=client_id,
        code=slugify(payload.name),
        display_name=payload.name,
        unit="colis",
        order=order,
        is_active=True,
    )
    db.add(group)
    db.flush()

    price = (
        payload.unit_price_ex_vat
        if payload.unit_price_ex_vat is not None
        else Decimal("0")
    )
    tariff = Tariff(
        tenant_id=tenant_id_int,
        tariff_group_id=group.id,
        price_ex_vat=price,
        effective_from=date.today(),
    )
    db.add(tariff)
    db.commit()
    db.refresh(group)
    db.refresh(tariff)
    return CategoryRead(
        id=group.id,
        name=group.display_name,
        unit_price_ex_vat=tariff.price_ex_vat,
    )


@router.patch(
    "/{client_id}/categories/{category_id}", response_model=CategoryRead
)
def update_category(
    client_id: int,
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> CategoryRead:
    tenant_id_int = int(tenant_id)
    group = db.execute(
        select(TariffGroup).where(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
            TariffGroup.id == category_id,
            TariffGroup.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Category not found")
    group.display_name = payload.name

    today = date.today()
    active_tariff = (
        db.execute(
            select(Tariff)
            .where(
                Tariff.tariff_group_id == group.id,
                Tariff.effective_from <= today,
                or_(Tariff.effective_to.is_(None), Tariff.effective_to >= today),
            )
            .order_by(Tariff.effective_from.desc())
        )
        .scalars()
        .first()
    )

    if payload.unit_price_ex_vat is not None:
        if active_tariff:
            active_tariff.price_ex_vat = payload.unit_price_ex_vat
        else:
            active_tariff = Tariff(
                tenant_id=tenant_id_int,
                tariff_group_id=group.id,
                price_ex_vat=payload.unit_price_ex_vat,
                effective_from=today,
            )
            db.add(active_tariff)

    db.commit()
    db.refresh(group)

    current_price = Decimal("0")
    if active_tariff:
        db.refresh(active_tariff)
        current_price = active_tariff.price_ex_vat

    return CategoryRead(
        id=group.id,
        name=group.display_name,
        unit_price_ex_vat=current_price,
    )


@router.delete("/{client_id}/categories/{category_id}", status_code=204)
def delete_category(
    client_id: int,
    category_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> None:
    tenant_id_int = int(tenant_id)
    group = db.execute(
        select(TariffGroup).where(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
            TariffGroup.id == category_id,
            TariffGroup.is_active.is_(True),
        )
    ).scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Category not found")
    group.is_active = False
    db.commit()
    return None
