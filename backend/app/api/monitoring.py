from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_id, require_roles
from app.db.session import get_db
from app.schemas.monitoring import MonitoringOverview
from app.services.monitoring import MonitoringService

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/overview", response_model=MonitoringOverview)
def get_monitoring_overview(
    db: Session = Depends(get_db),  # noqa: B008
    tenant_id: int = Depends(get_tenant_id),  # noqa: B008
    _: dict = Depends(require_roles("GLOBAL_SUPERVISION")),  # noqa: B008
) -> MonitoringOverview:
    service = MonitoringService(db, tenant_id)
    return service.get_overview()
