from datetime import datetime

from pydantic import BaseModel


class ActivitySummary(BaseModel):
    total: int
    active: int
    inactive: int
    last_activity_at: datetime | None


class ChauffeurSummary(ActivitySummary):
    active_last_24h: int


class MonitoringEvent(BaseModel):
    timestamp: datetime | None
    actor_role: str
    entity: str
    action: str
    has_authenticated_actor: bool


class MonitoringOverview(BaseModel):
    admins: ActivitySummary
    chauffeurs: ChauffeurSummary
    recent_events: list[MonitoringEvent]
    gdpr_notice: str
