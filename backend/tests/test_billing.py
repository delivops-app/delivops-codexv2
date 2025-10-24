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
from app.services.stripe_stub import DummyStripe


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

