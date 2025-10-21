from sqlalchemy import Column, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import relationship

from .base import Base


class Tenant(Base):
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    timezone = Column(String, default="UTC")
    locale = Column(String, default="fr")
    max_chauffeurs = Column(Integer, default=0)
    active_subscription_id = Column(
        Integer, ForeignKey("tenant_subscriptions.id"), nullable=True
    )

    subscriptions = relationship(
        "TenantSubscription",
        back_populates="tenant",
        cascade="all, delete-orphan",
        foreign_keys="TenantSubscription.tenant_id",
    )
    active_subscription = relationship(
        "TenantSubscription",
        foreign_keys=[active_subscription_id],
        post_update=True,
        uselist=False,
    )


class TenantSubscription(Base):
    __tablename__ = "tenant_subscriptions"

    tenant_id = Column(
        Integer, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False
    )
    shopify_plan_id = Column(String, nullable=False)
    max_chauffeurs = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    period = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)

    tenant = relationship(
        "Tenant",
        back_populates="subscriptions",
        foreign_keys=[tenant_id],
    )
