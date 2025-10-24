from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Boolean,
    String,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .base import Base


class PlanTier(str, enum.Enum):
    START = "START"
    PRO = "PRO"
    BUSINESS = "BUSINESS"
    ENTERPRISE = "ENTERPRISE"
    EARLY_PARTNER = "EARLY_PARTNER"


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "TRIALING"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    PAUSED = "PAUSED"


class Tenant(Base):
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    timezone = Column(String, default="UTC")
    locale = Column(String, default="fr")
    max_chauffeurs = Column(Integer, default=0)
    plan = Column(Enum(PlanTier), default=PlanTier.START, nullable=False)
    subscription_status = Column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.TRIALING, nullable=False
    )
    stripe_customer_id = Column(String, nullable=True, unique=True)
    stripe_subscription_id = Column(String, nullable=True, unique=True)
    trial_ends_at = Column(DateTime, nullable=True)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    subscription_status_since = Column(DateTime, default=datetime.utcnow, nullable=False)
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
    entitlements = relationship(
        "Entitlement",
        back_populates="tenant",
        cascade="all, delete-orphan",
        foreign_keys="Entitlement.tenant_id",
    )


class TenantSubscription(Base):
    __tablename__ = "tenant_subscriptions"
    __table_args__ = (
        UniqueConstraint(
            "shopify_subscription_id",
            name="uq_tenant_subscriptions_shopify_subscription_id",
        ),
    )

    tenant_id = Column(
        Integer, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False
    )
    shopify_plan_id = Column(String, nullable=False)
    shopify_subscription_id = Column(String, index=True, nullable=True)
    max_chauffeurs = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    period = Column(JSON, nullable=True)
    metadata_json = Column("metadata", JSON, nullable=True)

    tenant = relationship(
        "Tenant",
        back_populates="subscriptions",
        foreign_keys=[tenant_id],
    )


class Entitlement(Base):
    __tablename__ = "entitlements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_entitlements_tenant_key"),
    )

    tenant_id = Column(
        Integer, ForeignKey("tenant.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key = Column(String, nullable=False)
    bool_value = Column(Boolean, nullable=True)
    int_value = Column(Integer, nullable=True)
    str_value = Column(String, nullable=True)

    tenant = relationship(
        "Tenant",
        back_populates="entitlements",
        foreign_keys=[tenant_id],
    )
