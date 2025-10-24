"""Integration tests covering the Stripe billing workflow."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.base import Base
from app.models.tenant import (
    Entitlement,
    PlanTier,
    SubscriptionStatus,
    Tenant,
)
from app.services import billing as billing_service


# A dedicated in-memory database is used to keep the billing scenarios hermetic.
engine = create_engine(
    "sqlite://",
    future=True,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    bind=engine, autocommit=False, autoflush=False, future=True
)
Base.metadata.create_all(bind=engine)


class DummyStripe:
    """Very small in-memory stub mimicking the Stripe SDK used in the service."""

    class _SignatureVerificationError(Exception):
        pass

    class _HTTPClient:
        def __init__(self, outer: "DummyStripe") -> None:
            self.outer = outer

        def RequestsClient(self, timeout: int) -> dict[str, int]:
            self.outer.request_client_timeout = timeout
            return {"timeout": timeout}

    class _CustomerAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.outer = outer

        def create(self, **payload):
            self.outer.created_customers.append(payload)
            return {"id": self.outer.customer_id}

    class _CheckoutSessionAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.outer = outer

        def create(self, **payload):
            self.outer.checkout_sessions.append(payload)
            return {"url": self.outer.checkout_url}

    class _CheckoutAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.Session = DummyStripe._CheckoutSessionAPI(outer)

    class _BillingPortalSessionAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.outer = outer

        def create(self, **payload):
            self.outer.portal_sessions.append(payload)
            return {"url": self.outer.portal_url}

    class _BillingPortalAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.Session = DummyStripe._BillingPortalSessionAPI(outer)

    class _WebhookAPI:
        def __init__(self, outer: "DummyStripe") -> None:
            self.outer = outer

        def construct_event(self, payload: bytes, sig_header: str, secret: str):
            self.outer.webhook_calls.append(
                {"payload": payload, "signature": sig_header, "secret": secret}
            )
            if self.outer.webhook_exception is not None:
                raise self.outer.webhook_exception
            return self.outer.next_event

    def __init__(self) -> None:
        self.api_key: str | None = None
        self.default_http_client = None
        self.request_client_timeout: int | None = None
        self.customer_id = "cus_test_123"
        self.checkout_url = "https://stripe.test/checkout"
        self.portal_url = "https://stripe.test/portal"
        self.created_customers: list[dict] = []
        self.checkout_sessions: list[dict] = []
        self.portal_sessions: list[dict] = []
        self.webhook_calls: list[dict] = []
        self.next_event: dict | None = None
        self.webhook_exception: Exception | None = None

        self.http_client = DummyStripe._HTTPClient(self)
        self.Customer = DummyStripe._CustomerAPI(self)
        self.checkout = DummyStripe._CheckoutAPI(self)
        self.billing_portal = DummyStripe._BillingPortalAPI(self)
        self.Webhook = DummyStripe._WebhookAPI(self)
        self.error = type(
            "error",
            (),
            {"SignatureVerificationError": DummyStripe._SignatureVerificationError},
        )


def reset_database() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = OFF")
        for table in Base.metadata.tables.values():
            connection.execute(table.delete())
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")


def create_tenant(db: Session, slug: str = "acme") -> Tenant:
    tenant = Tenant(name=f"Tenant {slug}", slug=slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@pytest.fixture(autouse=True)
def configure_settings():
    original = {
        "dev_fake_auth": settings.dev_fake_auth,
        "stripe_secret_key": settings.stripe_secret_key,
        "stripe_webhook_secret": settings.stripe_webhook_secret,
        "stripe_price_early_partner": settings.stripe_price_early_partner,
        "stripe_customer_portal_return_url": settings.stripe_customer_portal_return_url,
        "stripe_checkout_success_url": settings.stripe_checkout_success_url,
        "stripe_checkout_cancel_url": settings.stripe_checkout_cancel_url,
    }
    settings.dev_fake_auth = True
    settings.stripe_secret_key = "sk_test_dummy"
    settings.stripe_webhook_secret = "whsec_dummy"
    settings.stripe_price_early_partner = "price_dummy"
    settings.stripe_customer_portal_return_url = "https://return.test/billing"
    settings.stripe_checkout_success_url = "https://return.test/billing/success"
    settings.stripe_checkout_cancel_url = "https://return.test/billing/cancel"
    try:
        yield
    finally:
        for key, value in original.items():
            setattr(settings, key, value)


@pytest.fixture()
def client():
    previous_override = app.dependency_overrides.get(get_db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is not None:
            app.dependency_overrides[get_db] = previous_override
        else:
            app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def stripe_stub(monkeypatch):
    stub = DummyStripe()
    monkeypatch.setattr(billing_service, "_get_stripe", lambda: stub)
    return stub


def test_create_checkout_session_creates_customer(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="acme")
        tenant_id = tenant.id

    response = client.post(
        "/billing/create-checkout-session",
        json={"organizationId": tenant_id},
        headers={"X-Tenant-Id": "acme", "X-Dev-Role": "ADMIN"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["url"] == stripe_stub.checkout_url
    assert stripe_stub.created_customers
    customer_metadata = stripe_stub.created_customers[0]["metadata"]
    assert customer_metadata == {"tenant_id": str(tenant_id)}

    with TestingSessionLocal() as db:
        refreshed = db.get(Tenant, tenant_id)
        assert refreshed is not None
        assert refreshed.stripe_customer_id == stripe_stub.customer_id


def test_checkout_session_reuses_existing_customer(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="beta")
        tenant.stripe_customer_id = "cus_existing"
        db.add(tenant)
        db.commit()
        tenant_id = tenant.id

    response = client.post(
        "/billing/create-checkout-session",
        json={"organizationId": tenant_id},
        headers={"X-Tenant-Id": "beta", "X-Dev-Role": "ADMIN"},
    )

    assert response.status_code == 200
    assert response.json()["url"] == stripe_stub.checkout_url
    assert stripe_stub.created_customers == []


def test_portal_requires_existing_customer(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="no-stripe")
        tenant_id = tenant.id

    response = client.post(
        "/billing/portal",
        json={"organizationId": tenant_id},
        headers={"X-Tenant-Id": "no-stripe", "X-Dev-Role": "ADMIN"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Organization is not linked to Stripe"


def test_portal_session_success(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="has-stripe")
        tenant.stripe_customer_id = "cus_portal"
        db.add(tenant)
        db.commit()
        tenant_id = tenant.id

    response = client.post(
        "/billing/portal",
        json={"organizationId": tenant_id},
        headers={"X-Tenant-Id": "has-stripe", "X-Dev-Role": "ADMIN"},
    )

    assert response.status_code == 200
    assert response.json()["url"] == stripe_stub.portal_url
    assert stripe_stub.portal_sessions[0]["customer"] == "cus_portal"


def test_billing_state_includes_entitlements_and_gate(client):
    reset_database()
    now = datetime.utcnow()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="state")
        tenant.subscription_status = SubscriptionStatus.PAST_DUE
        tenant.subscription_status_since = now - timedelta(
            days=settings.billing_read_only_after_days + 1
        )
        entitlement = Entitlement(
            tenant_id=tenant.id, key="users_max", int_value=12
        )
        db.add(entitlement)
        db.add(tenant)
        db.commit()

    response = client.get(
        "/billing/state",
        headers={"X-Tenant-Id": "state", "X-Dev-Role": "ADMIN"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["subscriptionStatus"] == SubscriptionStatus.PAST_DUE.value
    assert payload["entitlements"]["users_max"] == 12
    assert payload["gate"] == {"access": "read_only", "graceDays": 11}
    assert payload["stripePortalReturnUrl"] == "https://return.test/billing"


def test_webhook_checkout_session_completed_provisions_entitlements(
    client, stripe_stub
):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="checkout")
        tenant_id = tenant.id

    stripe_stub.next_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {"tenant_id": str(tenant_id)},
                "customer": "cus_evt",
                "subscription": "sub_evt",
            }
        },
    }

    response = client.post(
        "/stripe/webhook",
        data=b"{}",
        headers={"stripe-signature": "signature"},
    )

    assert response.status_code == 200
    with TestingSessionLocal() as db:
        refreshed = db.get(Tenant, tenant_id)
        assert refreshed.plan == PlanTier.EARLY_PARTNER
        assert refreshed.subscription_status == SubscriptionStatus.ACTIVE
        assert refreshed.stripe_customer_id == "cus_evt"
        assert refreshed.stripe_subscription_id == "sub_evt"
        entitlement_keys = {ent.key for ent in refreshed.entitlements}
        assert entitlement_keys == set(billing_service.EARLY_PARTNER_ENTITLEMENTS.keys())


def test_webhook_invoice_payment_failed_sets_past_due(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="past-due")
        tenant.stripe_customer_id = "cus_fail"
        tenant.subscription_status = SubscriptionStatus.ACTIVE
        db.add(tenant)
        db.commit()
        tenant_id = tenant.id

    stripe_stub.next_event = {
        "type": "invoice.payment_failed",
        "data": {"object": {"customer": "cus_fail"}},
    }

    response = client.post(
        "/stripe/webhook",
        data=b"{}",
        headers={"stripe-signature": "signature"},
    )

    assert response.status_code == 200
    with TestingSessionLocal() as db:
        refreshed = db.get(Tenant, tenant_id)
        assert refreshed.subscription_status == SubscriptionStatus.PAST_DUE


def test_webhook_subscription_deleted_sets_canceled(client, stripe_stub):
    reset_database()
    with TestingSessionLocal() as db:
        tenant = create_tenant(db, slug="canceled")
        tenant.stripe_customer_id = "cus_cancel"
        tenant.stripe_subscription_id = "sub_active"
        tenant.subscription_status = SubscriptionStatus.ACTIVE
        db.add(tenant)
        db.commit()
        tenant_id = tenant.id

    stripe_stub.next_event = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_cancel"}},
    }

    response = client.post(
        "/stripe/webhook",
        data=b"{}",
        headers={"stripe-signature": "signature"},
    )

    assert response.status_code == 200
    with TestingSessionLocal() as db:
        refreshed = db.get(Tenant, tenant_id)
        assert refreshed.subscription_status == SubscriptionStatus.CANCELED
        assert refreshed.stripe_subscription_id is None

