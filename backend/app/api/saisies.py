from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.saisie import Saisie
from app.models.tournee import Tournee
from app.schemas.saisie import SaisieCreate, SaisieUpdate, SaisieRead

router = APIRouter(prefix="/saisies", tags=["saisies"])


@router.post("", response_model=SaisieRead, status_code=201, include_in_schema=False)
@router.post("/", response_model=SaisieRead, status_code=201)
def create_saisie(
    saisie_in: SaisieCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tournee = db.get(Tournee, saisie_in.tournee_id)
    if tournee is None or tournee.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Tournee not found")
    saisie = Saisie(
        tenant_id=tenant_id,
        tournee_id=saisie_in.tournee_id,
        type=saisie_in.type,
        groupe_colis=saisie_in.groupe_colis,
        nb_recup=saisie_in.nb_recup,
        nb_livres=saisie_in.nb_livres,
        commentaire=saisie_in.commentaire,
    )
    db.add(saisie)
    db.commit()
    db.refresh(saisie)
    return saisie


@router.put("/{saisie_id}", response_model=SaisieRead)
def update_saisie(
    saisie_id: int,
    saisie_in: SaisieUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    saisie = db.get(Saisie, saisie_id)
    if saisie is None or saisie.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Saisie not found")
    if saisie_in.type is not None:
        saisie.type = saisie_in.type
    if saisie_in.groupe_colis is not None:
        saisie.groupe_colis = saisie_in.groupe_colis
    if saisie_in.nb_recup is not None:
        saisie.nb_recup = saisie_in.nb_recup
    if saisie_in.nb_livres is not None:
        saisie.nb_livres = saisie_in.nb_livres
    if saisie_in.commentaire is not None:
        saisie.commentaire = saisie_in.commentaire
    db.commit()
    db.refresh(saisie)
    return saisie
