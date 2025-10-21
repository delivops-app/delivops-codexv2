from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_tenant_roles
from app.db.session import get_db
from app.models.tournee import Tournee


router = APIRouter(prefix="/tournees", tags=["tournees"])


@router.get("/synthese")
def synthese_tournees(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    user: dict = Depends(require_tenant_roles("ADMIN")),  # noqa: B008
):
    tournees = (
        db.query(Tournee)
        .filter(Tournee.tenant_id == tenant_id)
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
            g = s.groupe_colis
            if g in row_groups:
                nb_livres = s.nb_livres or 0
                row_groups[g] += nb_livres
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
    return {"data": data, "groups": groups}
