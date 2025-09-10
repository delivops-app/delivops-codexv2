from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.deps import get_tenant_id
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant
from app.schemas.chauffeur import ChauffeurCreate, ChauffeurRead
from app.core.email import send_activation_email

router = APIRouter(prefix="/chauffeurs", tags=["chauffeurs"])

templates = Jinja2Templates(directory="app/templates")


@router.get("/invite", response_class=HTMLResponse)
def invite_chauffeur_form(request: Request):
    return templates.TemplateResponse("invite_chauffeur.html", {"request": request})


@router.get("/count")
def count_chauffeurs(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
):
    tenant_id_int = int(tenant_id)
    count = db.query(Chauffeur).filter(Chauffeur.tenant_id == tenant_id_int).count()
    tenant = db.get(Tenant, tenant_id_int)
    subscribed = tenant.max_chauffeurs if tenant else 0
    return {"count": count, "subscribed": subscribed}


@router.post("/", response_model=ChauffeurRead, status_code=201)
def create_chauffeur(
    chauffeur_in: ChauffeurCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id),
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
    db.commit()
    db.refresh(chauffeur)
    token = token_urlsafe(32)
    activation_link = f"https://example.com/activate?token={token}"
    send_activation_email(chauffeur.email, activation_link)
    return chauffeur
