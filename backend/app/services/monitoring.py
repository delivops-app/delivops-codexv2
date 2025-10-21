"""Services utilisés pour la supervision des activités."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.chauffeur import Chauffeur
from app.models.user import User
from app.schemas.monitoring import (
    ActivitySummary,
    ChauffeurSummary,
    MonitoringEvent,
    MonitoringOverview,
)


class MonitoringService:
    """Construit des indicateurs de suivi sans exposer de données personnelles."""

    _ID_SEGMENT_RE = re.compile(r"/[0-9]+(?=/|$)")
    _HEX_SEGMENT_RE = re.compile(r"/[0-9a-fA-F-]{8,}(?=/|$)")

    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    def get_overview(self, event_limit: int = 10) -> MonitoringOverview:
        """Retourne un résumé des activités administrateurs et chauffeurs."""

        admin_summary = self._build_admin_summary()
        chauffeur_summary = self._build_chauffeur_summary()
        recent_events = list(self._build_recent_events(limit=event_limit))

        notice = (
            "Les indicateurs sont agrégés et ne comportent pas de données personnelles. "
            "Les chemins d'API sont pseudonymisés lorsqu'ils contiennent des identifiants."
        )

        return MonitoringOverview(
            admins=admin_summary,
            chauffeurs=chauffeur_summary,
            recent_events=recent_events,
            gdpr_notice=notice,
        )

    def _build_admin_summary(self) -> ActivitySummary:
        total = (
            self.db.query(func.count(User.id))
            .filter(User.tenant_id == self.tenant_id, User.role == "ADMIN")
            .scalar()
            or 0
        )
        active = (
            self.db.query(func.count(User.id))
            .filter(
                User.tenant_id == self.tenant_id,
                User.role == "ADMIN",
                User.is_active.is_(True),
            )
            .scalar()
            or 0
        )
        last_activity = (
            self.db.query(func.max(AuditLog.created_at))
            .join(User, AuditLog.user_id == User.id)
            .filter(
                AuditLog.tenant_id == self.tenant_id,
                User.role == "ADMIN",
            )
            .scalar()
        )

        return ActivitySummary(
            total=total,
            active=active,
            inactive=max(total - active, 0),
            last_activity_at=last_activity,
        )

    def _build_chauffeur_summary(self) -> ChauffeurSummary:
        total = (
            self.db.query(func.count(Chauffeur.id))
            .filter(Chauffeur.tenant_id == self.tenant_id)
            .scalar()
            or 0
        )
        active = (
            self.db.query(func.count(Chauffeur.id))
            .filter(
                Chauffeur.tenant_id == self.tenant_id,
                Chauffeur.is_active.is_(True),
            )
            .scalar()
            or 0
        )
        last_seen = (
            self.db.query(func.max(Chauffeur.last_seen_at))
            .filter(
                Chauffeur.tenant_id == self.tenant_id,
                Chauffeur.last_seen_at.isnot(None),
            )
            .scalar()
        )

        recent_threshold = datetime.utcnow() - timedelta(hours=24)
        active_last_24h = (
            self.db.query(func.count(Chauffeur.id))
            .filter(
                Chauffeur.tenant_id == self.tenant_id,
                Chauffeur.last_seen_at.isnot(None),
                Chauffeur.last_seen_at >= recent_threshold,
            )
            .scalar()
            or 0
        )

        return ChauffeurSummary(
            total=total,
            active=active,
            inactive=max(total - active, 0),
            last_activity_at=last_seen,
            active_last_24h=active_last_24h,
        )

    def _build_recent_events(self, limit: int) -> Iterable[MonitoringEvent]:
        rows = (
            self.db.query(
                AuditLog.created_at,
                AuditLog.entity,
                AuditLog.action,
                User.role,
            )
            .outerjoin(User, AuditLog.user_id == User.id)
            .filter(AuditLog.tenant_id == self.tenant_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

        for created_at, entity, action, role in rows:
            sanitized_entity = self._sanitize_entity(entity)
            actor_role = role if role else "ANONYMOUS"
            yield MonitoringEvent(
                timestamp=created_at,
                actor_role=actor_role,
                entity=sanitized_entity,
                action=action,
                has_authenticated_actor=bool(role),
            )

    def _sanitize_entity(self, entity: str | None) -> str:
        if not entity:
            return "/"

        sanitized = self._ID_SEGMENT_RE.sub("/:id", entity)
        sanitized = self._HEX_SEGMENT_RE.sub("/:token", sanitized)
        return sanitized
