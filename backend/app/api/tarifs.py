from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_tenant_id, require_tenant_roles
from app.models.tarif import Tarif
from app.schemas.tarif import TarifCreate, TarifRead, TarifUpdate
from app.models.client import Client

router = APIRouter(prefix="/tarifs", tags=["tarifs"])


def _get_client_for_tenant(db: Session, client_id: int, tenant_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Client does not belong to tenant")
    return client


@router.post("", response_model=TarifRead, status_code=201, include_in_schema=False)
@router.post("/", response_model=TarifRead, status_code=201)
def create_tarif(
    tarif_in: TarifCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_tenant_roles("ADMIN")),  # noqa: B008
):
    _get_client_for_tenant(db, tarif_in.client_id, tenant_id)
    tarif = Tarif(tenant_id=tenant_id, **tarif_in.model_dump())
    db.add(tarif)
    db.commit()
    db.refresh(tarif)
    return tarif


@router.put("/{tarif_id}", response_model=TarifRead)
def update_tarif(
    tarif_id: int,
    tarif_in: TarifUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_tenant_roles("ADMIN")),  # noqa: B008
):
    tarif = (
        db.query(Tarif)
        .filter(Tarif.id == tarif_id, Tarif.tenant_id == tenant_id)
        .first()
    )
    if tarif is None:
        raise HTTPException(status_code=404, detail="Tarif not found")
    _get_client_for_tenant(db, tarif.client_id, tenant_id)
    update_data = tarif_in.model_dump(exclude_unset=True)
    if "client_id" in update_data:
        _get_client_for_tenant(db, update_data["client_id"], tenant_id)
    for field, value in update_data.items():
        setattr(tarif, field, value)
    db.commit()
    db.refresh(tarif)
    return tarif


@router.delete("/{tarif_id}", status_code=204)
def delete_tarif(
    tarif_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_tenant_roles("ADMIN")),  # noqa: B008
):
    tarif = (
        db.query(Tarif)
        .filter(Tarif.id == tarif_id, Tarif.tenant_id == tenant_id)
        .first()
    )
    if tarif is None:
        raise HTTPException(status_code=404, detail="Tarif not found")
    db.delete(tarif)
    db.commit()
    return None
