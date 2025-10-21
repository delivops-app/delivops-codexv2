import base64
import hmac
import json
from typing import Any

from app.core.config import settings
from app.models.integration import IntegrationEvent
from app.models.tenant import Tenant, TenantSubscription
from tests.test_chauffeurs import TestingSessionLocal, app_test_client


def _sign(payload: dict[str, Any], secret: str) -> tuple[str, bytes]:
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    digest = hmac.new(secret.encode("utf-8"), raw_body, digestmod="sha256").digest()
    signature = base64.b64encode(digest).decode("utf-8")
    return signature, raw_body


def test_shopify_webhook_creates_subscription():
    secret = "super-secret"
    original_secret = settings.shopify_webhook_secret
    settings.shopify_webhook_secret = secret

    try:
        with TestingSessionLocal() as db:
            tenant = Tenant(name="Acme", slug="acme", max_chauffeurs=0)
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            tenant_id = tenant.id

        payload = {
            "event_id": "evt-1",
            "subscription_id": "sub-1",
            "tenant_slug": "acme",
            "shopify_plan_id": "plan-pro",
            "max_chauffeurs": 5,
            "status": "active",
            "period": {"start_at": "2024-02-01T00:00:00Z", "end_at": None},
            "metadata": {"origin": "test"},
        }

        signature, raw_body = _sign(payload, secret)

        with app_test_client() as client:
            response = client.post(
                "/integrations/shopify/webhooks/subscription",
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Hmac-Sha256": signature,
                    "X-Shopify-Topic": "subscriptions/update",
                },
                content=raw_body,
            )

        assert response.status_code == 200
        assert response.json()["status"] == "updated"
        assert response.json()["max_chauffeurs"] == 5

        with TestingSessionLocal() as db:
            tenant = db.get(Tenant, tenant_id)
            assert tenant.max_chauffeurs == 5
            assert tenant.active_subscription is not None
            assert tenant.active_subscription.shopify_subscription_id == "sub-1"
            event = (
                db.query(IntegrationEvent)
                .filter(IntegrationEvent.event_id == "evt-1")
                .first()
            )
            assert event is not None
            assert event.processed_at is not None
    finally:
        settings.shopify_webhook_secret = original_secret


def test_shopify_webhook_duplicate_event():
    secret = "super-secret"
    original_secret = settings.shopify_webhook_secret
    settings.shopify_webhook_secret = secret

    try:
        with TestingSessionLocal() as db:
            tenant = Tenant(name="Beta", slug="beta", max_chauffeurs=0)
            subscription = TenantSubscription(
                tenant=tenant,
                shopify_plan_id="plan-basic",
                shopify_subscription_id="sub-2",
                max_chauffeurs=2,
                status="active",
            )
            tenant.active_subscription = subscription
            tenant.max_chauffeurs = 2
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        payload = {
            "event_id": "evt-dup",
            "subscription_id": "sub-2",
            "tenant_slug": "beta",
            "shopify_plan_id": "plan-basic",
            "max_chauffeurs": 2,
            "status": "active",
            "period": None,
            "metadata": None,
        }

        signature, raw_body = _sign(payload, secret)

        with app_test_client() as client:
            response_first = client.post(
                "/integrations/shopify/webhooks/subscription",
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Hmac-Sha256": signature,
                },
                content=raw_body,
            )
        assert response_first.status_code == 200
        assert response_first.json()["status"] == "updated"

        with app_test_client() as client:
            response_second = client.post(
                "/integrations/shopify/webhooks/subscription",
                headers={
                    "Content-Type": "application/json",
                    "X-Shopify-Hmac-Sha256": signature,
                },
                content=raw_body,
            )
        assert response_second.status_code == 200
        assert response_second.json()["status"] == "ignored"
    finally:
        settings.shopify_webhook_secret = original_secret
