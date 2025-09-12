from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.models.tournee import Tournee

router = APIRouter(prefix="/tournees", tags=["tournees"])

templates = Jinja2Templates(directory="app/templates")


@router.get("/synthese", response_class=HTMLResponse)
def synthese_tournees(
    request: Request,
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_roles("ADMIN")),  # noqa: B008
):
    tenant_id_int = int(tenant_id)
    tournees = (
        db.query(Tournee)
        .filter(Tournee.tenant_id == tenant_id_int)
        .order_by(Tournee.date)
        .all()
    )
    groups = sorted(
        {
            s.groupe_colis
            for t in tournees
            for s in t.saisies
            if s.groupe_colis is not None
        }
    )
    data = []
    for t in tournees:
        row_groups = {g: 0 for g in groups}
        total = 0
        for s in t.saisies:
            if s.groupe_colis in row_groups:
                nb_livres = s.nb_livres if s.nb_livres is not None else 0
                row_groups[s.groupe_colis] = nb_livres
                total += nb_livres
        data.append(
            {
                "date": t.date,
                "chauffeur": t.chauffeur.display_name if t.chauffeur else "",
                "client": t.client.name if t.client else "",
                "groups": row_groups,
                "total": total,
            }
        )
    return templates.TemplateResponse(
        "synthese_tournees.html",
        {"request": request, "data": data, "groups": groups, "tenant_id": tenant_id},
    )
