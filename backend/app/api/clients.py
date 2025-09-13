from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.client import Client
from app.models.tariff_group import TariffGroup
from app.schemas.client import ClientWithCategories, CategoryRead

router = APIRouter(prefix="/clients", tags=["clients"])


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
        categories = [CategoryRead(id=g.id, name=g.display_name) for g in groups]
        result.append(
            ClientWithCategories(id=client.id, name=client.name, categories=categories)
        )
    return result
