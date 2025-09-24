from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_tenant_id, require_roles
from app.schemas.chauffeur import ChauffeurCreate, ChauffeurRead, ChauffeurUpdate
from app.core.email import send_activation_email
from app.services.chauffeurs import (
    ChauffeurLimitReachedError,
    ChauffeurNotFoundError,
    ChauffeurService,
    TenantNotFoundError,
)

router = APIRouter(prefix="/chauffeurs", tags=["chauffeurs"])


@router.get("/count")
def count_chauffeurs(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
):
    service = ChauffeurService(db, tenant_id)
    count, subscribed = service.count_and_subscription()
    return {"count": count, "subscribed": subscribed}


@router.get("", response_model=list[ChauffeurRead], include_in_schema=False)
@router.get("/", response_model=list[ChauffeurRead])
def list_chauffeurs(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    service = ChauffeurService(db, tenant_id)
    return service.list()


@router.post("", response_model=ChauffeurRead, status_code=201, include_in_schema=False)
@router.post("/", response_model=ChauffeurRead, status_code=201)
def create_chauffeur(
    chauffeur_in: ChauffeurCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    service = ChauffeurService(db, tenant_id)
    user_sub = user.get("sub") if isinstance(user, dict) else None
    try:
        chauffeur = service.create(chauffeur_in, user_sub)
    except TenantNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        ) from None
    except ChauffeurLimitReachedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    token = token_urlsafe(32)
    activation_link = f"https://example.com/activate?token={token}"
    send_activation_email(chauffeur.email, activation_link)
    return chauffeur


@router.put("/{chauffeur_id}", response_model=ChauffeurRead)
def update_chauffeur(
    chauffeur_id: int,
    chauffeur_in: ChauffeurUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    service = ChauffeurService(db, tenant_id)
    user_sub = user.get("sub") if isinstance(user, dict) else None
    try:
        return service.update(chauffeur_id, chauffeur_in, user_sub)
    except ChauffeurNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chauffeur not found",
        ) from None


@router.delete("/{chauffeur_id}", status_code=204)
def delete_chauffeur(
    chauffeur_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    service = ChauffeurService(db, tenant_id)
    user_sub = user.get("sub") if isinstance(user, dict) else None
    try:
        service.delete(chauffeur_id, user_sub)
    except ChauffeurNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chauffeur not found",
        ) from None
    return None
