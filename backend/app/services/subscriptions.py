"""Services liés aux abonnements Shopify."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.integration import IntegrationEvent
from app.models.tenant import Tenant, TenantSubscription
from app.schemas.subscription import ShopifySubscriptionWebhook


class TenantSubscriptionNotFoundError(Exception):
    """Raised when a tenant cannot be resolved from the webhook payload."""


@dataclass
class ShopifyProcessingOutcome:
    tenant: Tenant
    subscription: TenantSubscription | None
    duplicate: bool


class ShopifySubscriptionService:
    """Handle Shopify webhook updates and convert them into tenant quotas."""

    ACTIVE_STATUSES = {"active", "trialing"}

    def __init__(self, db: Session) -> None:
        self.db = db

    def process_webhook(
        self, payload: ShopifySubscriptionWebhook, topic: str | None
    ) -> ShopifyProcessingOutcome:
        tenant = self._resolve_tenant(payload.tenant_slug)

        event = self.db.query(IntegrationEvent).filter(
            IntegrationEvent.provider == "shopify",
            IntegrationEvent.event_id == payload.event_id,
        ).first()

        if event and event.processed_at:
            subscription = self._find_subscription(
                tenant.id, payload.subscription_id
            )
            return ShopifyProcessingOutcome(
                tenant=tenant, subscription=subscription, duplicate=True
            )

        serialized_payload = payload.model_dump(mode="json", by_alias=True)

        if not event:
            event = IntegrationEvent(
                provider="shopify",
                event_id=payload.event_id,
                topic=topic,
                tenant=tenant,
                payload_json=serialized_payload,
            )
            self.db.add(event)
        else:
            event.topic = topic
            event.tenant = tenant
            event.payload_json = serialized_payload

        subscription = self._upsert_subscription(tenant, payload)
        self._update_tenant_quota(tenant, subscription, payload.status)
        self.db.flush()

        event.mark_processed()
        self._record_audit_entry(tenant, subscription, serialized_payload)

        self.db.commit()
        self.db.refresh(subscription)
        return ShopifyProcessingOutcome(
            tenant=tenant, subscription=subscription, duplicate=False
        )

    # Helpers -----------------------------------------------------------------

    def _resolve_tenant(self, slug: str) -> Tenant:
        tenant = self.db.query(Tenant).filter(Tenant.slug == slug).first()
        if tenant is None:
            raise TenantSubscriptionNotFoundError(f"Tenant with slug '{slug}' not found")
        return tenant

    def _find_subscription(
        self, tenant_id: int, subscription_id: str
    ) -> TenantSubscription | None:
        return (
            self.db.query(TenantSubscription)
            .filter(
                TenantSubscription.tenant_id == tenant_id,
                TenantSubscription.shopify_subscription_id == subscription_id,
            )
            .first()
        )

    def _upsert_subscription(
        self, tenant: Tenant, payload: ShopifySubscriptionWebhook
    ) -> TenantSubscription:
        subscription = self._find_subscription(tenant.id, payload.subscription_id)

        period_payload = (
            payload.period.model_dump(mode="json", by_alias=True)
            if payload.period
            else None
        )

        if subscription is None:
            subscription = TenantSubscription(
                tenant=tenant,
                shopify_plan_id=payload.shopify_plan_id,
                shopify_subscription_id=payload.subscription_id,
                max_chauffeurs=payload.max_chauffeurs,
                status=payload.status,
                period=period_payload,
                metadata_json=payload.metadata,
            )
            self.db.add(subscription)
        else:
            subscription.shopify_plan_id = payload.shopify_plan_id
            subscription.max_chauffeurs = payload.max_chauffeurs
            subscription.status = payload.status
            subscription.period = period_payload
            subscription.metadata_json = payload.metadata

        return subscription

    def _update_tenant_quota(
        self, tenant: Tenant, subscription: TenantSubscription, status: str
    ) -> None:
        normalized_status = status.lower()
        if normalized_status in self.ACTIVE_STATUSES:
            tenant.active_subscription = subscription
        else:
            tenant.active_subscription = None
        tenant.max_chauffeurs = subscription.max_chauffeurs

    def _record_audit_entry(
        self,
        tenant: Tenant,
        subscription: TenantSubscription,
        payload: dict,
    ) -> None:
        audit = AuditLog(
            tenant_id=tenant.id,
            user_id=None,
            entity="tenant_subscription",
            entity_id=subscription.id,
            action="shopify_webhook",
            before_json=None,
            after_json=json.dumps({
                "shopify_subscription_id": subscription.shopify_subscription_id,
                "shopify_plan_id": subscription.shopify_plan_id,
                "status": subscription.status,
                "max_chauffeurs": subscription.max_chauffeurs,
                "payload": payload,
            }, default=self._json_serializer),
        )
        self.db.add(audit)

    @staticmethod
    def _json_serializer(value):
        if isinstance(value, datetime):
            return value.isoformat()
        raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
