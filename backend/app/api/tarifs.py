from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_tenant_id, require_roles
from app.models.tarif import Tarif
from app.schemas.tarif import TarifCreate, TarifRead, TarifUpdate

router = APIRouter(prefix="/tarifs", tags=["tarifs"])


@router.post("/", response_model=TarifRead, status_code=201)
def create_tarif(
    tarif_in: TarifCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tarif = Tarif(tenant_id=int(tenant_id), **tarif_in.dict())
    db.add(tarif)
    db.commit()
    db.refresh(tarif)
    return tarif


@router.put("/{tarif_id}", response_model=TarifRead)
def update_tarif(
    tarif_id: int,
    tarif_in: TarifUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tarif = (
        db.query(Tarif)
        .filter(Tarif.id == tarif_id, Tarif.tenant_id == int(tenant_id))
        .first()
    )
    if tarif is None:
        raise HTTPException(status_code=404, detail="Tarif not found")
    for field, value in tarif_in.dict(exclude_unset=True).items():
        setattr(tarif, field, value)
    db.commit()
    db.refresh(tarif)
    return tarif


@router.delete("/{tarif_id}", status_code=204)
def delete_tarif(
    tarif_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tarif = (
        db.query(Tarif)
        .filter(Tarif.id == tarif_id, Tarif.tenant_id == int(tenant_id))
        .first()
    )
    if tarif is None:
        raise HTTPException(status_code=404, detail="Tarif not found")
    db.delete(tarif)
    db.commit()
    return None
