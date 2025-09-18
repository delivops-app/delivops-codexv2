from typing import List
import re

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
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


@router.get("/", response_model=List[ClientWithCategories])
def list_clients(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("CHAUFFEUR", "ADMIN")),  # noqa: B008
) -> List[ClientWithCategories]:
    """Return all active clients with their tariff categories."""
    tenant_id_int = int(tenant_id)
    clients = (
        db.query(Client)
        .filter(Client.tenant_id == tenant_id_int, Client.is_active.is_(True))
        .order_by(Client.name)
        .all()
    )

    today = date.today()
    result: List[ClientWithCategories] = []
    for client in clients:
        groups = (
            db.query(TariffGroup)
            .filter(
                TariffGroup.tenant_id == tenant_id_int,
                TariffGroup.client_id == client.id,
                TariffGroup.is_active.is_(True),
            )
            .order_by(TariffGroup.order)
            .all()
        )
        categories: list[CategoryRead] = []
        for g in groups:
            tariff = (
                db.query(Tariff)
                .filter(
                    Tariff.tariff_group_id == g.id,
                    Tariff.effective_from <= today,
                    or_(Tariff.effective_to.is_(None), Tariff.effective_to >= today),
                )
                .order_by(Tariff.effective_from.desc())
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
    client = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.name = payload.name
    db.commit()
    db.refresh(client)

    groups = (
        db.query(TariffGroup)
        .filter(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client.id,
            TariffGroup.is_active.is_(True),
        )
        .order_by(TariffGroup.order)
        .all()
    )
    categories = [CategoryRead(id=g.id, name=g.display_name) for g in groups]
    return ClientWithCategories(id=client.id, name=client.name, categories=categories)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> None:
    tenant_id_int = int(tenant_id)
    client = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    groups = (
        db.query(TariffGroup)
        .filter(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client.id,
            TariffGroup.is_active.is_(True),
        )
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
    client = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant_id_int,
            Client.id == client_id,
            Client.is_active.is_(True),
        )
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    max_order = (
        db.query(func.max(TariffGroup.order))
        .filter(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
        )
        .scalar()
    )
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
    db.commit()
    db.refresh(group)
    return CategoryRead(id=group.id, name=group.display_name)


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
    group = (
        db.query(TariffGroup)
        .filter(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
            TariffGroup.id == category_id,
            TariffGroup.is_active.is_(True),
        )
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Category not found")
    group.display_name = payload.name
    db.commit()
    db.refresh(group)
    return CategoryRead(id=group.id, name=group.display_name)


@router.delete("/{client_id}/categories/{category_id}", status_code=204)
def delete_category(
    client_id: int,
    category_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
) -> None:
    tenant_id_int = int(tenant_id)
    group = (
        db.query(TariffGroup)
        .filter(
            TariffGroup.tenant_id == tenant_id_int,
            TariffGroup.client_id == client_id,
            TariffGroup.id == category_id,
            TariffGroup.is_active.is_(True),
        )
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Category not found")
    group.is_active = False
    db.commit()
    return None
