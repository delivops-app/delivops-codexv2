from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_tenant_id, require_roles
from app.models.audit import AuditLog
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.chauffeur import ChauffeurCreate, ChauffeurRead, ChauffeurUpdate
from app.core.email import send_activation_email

router = APIRouter(prefix="/chauffeurs", tags=["chauffeurs"])

templates = Jinja2Templates(directory="app/templates")


@router.get("/invite", response_class=HTMLResponse)
def invite_chauffeur_form(request: Request, tenant_id: str = Depends(get_tenant_id)):
    return templates.TemplateResponse(
        "invite_chauffeur.html", {"request": request, "tenant_id": tenant_id}
    )


@router.get("/count")
def count_chauffeurs(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    count = db.query(Chauffeur).filter(Chauffeur.tenant_id == tenant_id_int).count()
    tenant = db.get(Tenant, tenant_id_int)
    subscribed = tenant.max_chauffeurs if tenant else 0
    return {"count": count, "subscribed": subscribed}


@router.get("/", response_model=list[ChauffeurRead])
def list_chauffeurs(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    chauffeurs = db.query(Chauffeur).filter(Chauffeur.tenant_id == tenant_id_int).all()
    return chauffeurs


@router.post("/", response_model=ChauffeurRead, status_code=201)
def create_chauffeur(
    chauffeur_in: ChauffeurCreate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    tenant = db.get(Tenant, tenant_id_int)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    current = db.query(Chauffeur).filter(Chauffeur.tenant_id == tenant_id_int).count()
    if tenant.max_chauffeurs and current >= tenant.max_chauffeurs:
        raise HTTPException(status_code=400, detail="Driver limit reached")
    chauffeur = Chauffeur(
        tenant_id=tenant_id_int,
        email=chauffeur_in.email,
        display_name=chauffeur_in.display_name,
    )
    db.add(chauffeur)
    db.flush()
    user_row = (
        db.query(User)
        .filter(User.auth0_sub == user.get("sub"), User.tenant_id == tenant_id_int)
        .first()
    )
    audit = AuditLog(
        tenant_id=tenant_id_int,
        user_id=user_row.id if user_row else None,
        entity="chauffeur",
        entity_id=chauffeur.id,
        action="create",
    )
    db.add(audit)
    db.commit()
    db.refresh(chauffeur)
    token = token_urlsafe(32)
    activation_link = f"https://example.com/activate?token={token}"
    send_activation_email(chauffeur.email, activation_link)
    return chauffeur


@router.put("/{chauffeur_id}", response_model=ChauffeurRead)
def update_chauffeur(
    chauffeur_id: int,
    chauffeur_in: ChauffeurUpdate,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    chauffeur = (
        db.query(Chauffeur)
        .filter(Chauffeur.id == chauffeur_id, Chauffeur.tenant_id == tenant_id_int)
        .first()
    )
    if chauffeur is None:
        raise HTTPException(status_code=404, detail="Chauffeur not found")
    if chauffeur_in.email is not None:
        chauffeur.email = chauffeur_in.email
    if chauffeur_in.display_name is not None:
        chauffeur.display_name = chauffeur_in.display_name
    if chauffeur_in.is_active is not None:
        chauffeur.is_active = chauffeur_in.is_active
    user_row = (
        db.query(User)
        .filter(User.auth0_sub == user.get("sub"), User.tenant_id == tenant_id_int)
        .first()
    )
    audit = AuditLog(
        tenant_id=tenant_id_int,
        user_id=user_row.id if user_row else None,
        entity="chauffeur",
        entity_id=chauffeur.id,
        action="update",
    )
    db.add(audit)
    db.commit()
    db.refresh(chauffeur)
    return chauffeur


@router.delete("/{chauffeur_id}", status_code=204)
def delete_chauffeur(
    chauffeur_id: int,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    chauffeur = (
        db.query(Chauffeur)
        .filter(Chauffeur.id == chauffeur_id, Chauffeur.tenant_id == tenant_id_int)
        .first()
    )
    if chauffeur is None:
        raise HTTPException(status_code=404, detail="Chauffeur not found")
    db.delete(chauffeur)
    user_row = (
        db.query(User)
        .filter(User.auth0_sub == user.get("sub"), User.tenant_id == tenant_id_int)
        .first()
    )
    audit = AuditLog(
        tenant_id=tenant_id_int,
        user_id=user_row.id if user_row else None,
        entity="chauffeur",
        entity_id=chauffeur_id,
        action="delete",
    )
    db.add(audit)
    db.commit()
    return None
