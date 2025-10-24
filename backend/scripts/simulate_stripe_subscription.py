"""Simulate the Stripe subscription flow without external dependencies.

The script spins up the FastAPI application with an in-memory SQLite database,
replaces the Stripe SDK by :class:`~app.services.stripe_stub.DummyStripe` and
walks through the following steps:

1. create a tenant;
2. run ``POST /billing/create-checkout-session`` to obtain the checkout URL;
3. trigger the ``checkout.session.completed`` webhook to provision the plan;
4. fetch ``GET /billing/state`` to visualise the resulting entitlements.

This provides the same behaviour as the integration tests while being directly
executable from the command line for exploratory scenarios.
"""

from __future__ import annotations

import argparse
import json
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.base import Base
from app.models.tenant import Tenant
from app.services import billing as billing_service
from app.services.stripe_stub import DummyStripe


DEFAULT_STRIPE_SETTINGS = {
    "stripe_secret_key": "sk_test_dummy",
    "stripe_webhook_secret": "whsec_dummy",
    "stripe_price_early_partner": "price_dummy",
    "stripe_customer_portal_return_url": "https://return.test/billing",
    "stripe_checkout_success_url": "https://return.test/billing/success",
    "stripe_checkout_cancel_url": "https://return.test/billing/cancel",
}


def apply_default_settings() -> Iterable[str]:
    """Ensure the configuration exposes the test-friendly Stripe settings."""

    applied = []
    for field, value in DEFAULT_STRIPE_SETTINGS.items():
        if not getattr(settings, field):
            setattr(settings, field, value)
            applied.append(field)

    settings.dev_fake_auth = True
    return applied


@contextmanager
def in_memory_database():
    """Provide an application database bound to an in-memory SQLite engine."""

    engine = create_engine(
        "sqlite://",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
    Base.metadata.create_all(bind=engine)

    def override_get_db():  # pragma: no cover - thin wrapper used in scripts
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        yield SessionLocal
    finally:
        if previous_override is not None:
            app.dependency_overrides[get_db] = previous_override
        else:
            app.dependency_overrides.pop(get_db, None)


def create_tenant(db: Session, slug: str) -> Tenant:
    tenant = Tenant(name=f"Tenant {slug}", slug=slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def simulate_checkout(client: TestClient, tenant: Tenant, stripe_stub: DummyStripe) -> str:
    response = client.post(
        "/billing/create-checkout-session",
        json={"organizationId": tenant.id},
        headers={"X-Tenant-Id": tenant.slug, "X-Dev-Role": "ADMIN"},
    )
    response.raise_for_status()
    url = response.json()["url"]
    print(f"Checkout session created: {url}")
    print(f"Stripe customer id: {stripe_stub.customer_id}")
    return url


def trigger_checkout_completed(
    client: TestClient, tenant: Tenant, stripe_stub: DummyStripe
) -> None:
    stripe_stub.next_event = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {"tenant_id": str(tenant.id)},
                "customer": "cus_evt",
                "subscription": "sub_evt",
            }
        },
    }
    response = client.post(
        "/stripe/webhook",
        data=json.dumps({}).encode("utf-8"),
        headers={"stripe-signature": "signature"},
    )
    response.raise_for_status()
    print("Webhook checkout.session.completed processed")


def display_billing_state(client: TestClient, tenant: Tenant) -> None:
    response = client.get(
        "/billing/state",
        headers={"X-Tenant-Id": tenant.slug, "X-Dev-Role": "ADMIN"},
    )
    response.raise_for_status()
    payload = response.json()
    print("Current billing state:")
    print(json.dumps(payload, indent=2, sort_keys=True))


def configure_entitlement_overrides(args: argparse.Namespace) -> None:
    if args.chauffeurs_max is not None:
        billing_service.EARLY_PARTNER_ENTITLEMENTS.setdefault("chauffeurs_max", {})[
            "int_value"
        ] = args.chauffeurs_max
    if args.users_max is not None:
        billing_service.EARLY_PARTNER_ENTITLEMENTS.setdefault("users_max", {})[
            "int_value"
        ] = args.users_max


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", default="demo", help="Slug of the tenant created for the demo")
    parser.add_argument(
        "--chauffeurs-max",
        type=int,
        help="Override the chauffeurs_max entitlement provisioned by the plan",
    )
    parser.add_argument(
        "--users-max",
        type=int,
        help="Override the users_max entitlement provisioned by the plan",
    )
    args = parser.parse_args()

    applied = apply_default_settings()
    if applied:
        print(f"Applied default settings for: {', '.join(applied)}")

    configure_entitlement_overrides(args)

    stripe_stub = DummyStripe()
    billing_service._get_stripe = lambda: stripe_stub

    with in_memory_database() as SessionLocal:
        with SessionLocal() as db:
            tenant = create_tenant(db, args.slug)

        with TestClient(app) as client:
            simulate_checkout(client, tenant, stripe_stub)
            trigger_checkout_completed(client, tenant, stripe_stub)
            display_billing_state(client, tenant)


if __name__ == "__main__":  # pragma: no cover - manual entry point
    main()

