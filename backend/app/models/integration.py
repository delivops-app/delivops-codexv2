from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base


class IntegrationEvent(Base):
    __tablename__ = "integration_events"
    __table_args__ = (
        UniqueConstraint(
            "provider", "event_id", name="uq_integration_events_provider_event"
        ),
    )

    provider = Column(String, nullable=False)
    event_id = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=True)
    payload_json = Column("payload", JSON, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant")

    def mark_processed(self) -> None:
        self.processed_at = datetime.utcnow()
