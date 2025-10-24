"""Stripe billing orchestration helpers."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tenant import Entitlement, PlanTier, SubscriptionStatus, Tenant

logger = logging.getLogger(__name__)


EARLY_PARTNER_ENTITLEMENTS: dict[str, dict[str, Any]] = {
    "saisie_chauffeur": {"bool_value": True},
    "export_excel": {"bool_value": True},
    "multi_client": {"bool_value": True},
    "score_fiabilite": {"bool_value": True},
    "alertes_oublis": {"bool_value": True},
    "users_max": {"int_value": 50},
    "chauffeurs_max": {"int_value": 150},
}


def _get_stripe() -> Any:
    import stripe  # Imported lazily to avoid hard dependency during module import.

    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe is not configured",
        )
    stripe.api_key = settings.stripe_secret_key
    stripe.default_http_client = stripe.http_client.RequestsClient(timeout=30)
    return stripe


def _ensure_customer(db: Session, tenant: Tenant) -> str:
    client = _get_stripe()
    if tenant.stripe_customer_id:
        return tenant.stripe_customer_id

    customer = client.Customer.create(
        name=tenant.name,
        metadata={"tenant_id": str(tenant.id)},
    )
    tenant.stripe_customer_id = customer["id"]
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant.stripe_customer_id


def create_checkout_session(db: Session, tenant: Tenant) -> str:
    client = _get_stripe()

    price_id = settings.stripe_price_early_partner
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe price is not configured",
        )

    success_url = settings.stripe_checkout_success_url
    cancel_url = settings.stripe_checkout_cancel_url
    if not success_url or not cancel_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe return URLs are not configured",
        )

    customer_id = _ensure_customer(db, tenant)
    metadata = {"tenant_id": str(tenant.id)}

    session = client.checkout.Session.create(
        mode="subscription",
        customer=customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        allow_promotion_codes=False,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        subscription_data={"metadata": metadata},
        automatic_tax={"enabled": True},
    )

    return session["url"]


def create_customer_portal_session(tenant: Tenant) -> str:
    if not tenant.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization is not linked to Stripe",
        )

    client = _get_stripe()
    return_url = settings.stripe_customer_portal_return_url
    if not return_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe portal return URL is not configured",
        )

    portal_session = client.billing_portal.Session.create(
        customer=tenant.stripe_customer_id,
        return_url=return_url,
    )
    return portal_session["url"]


def _get_tenant_by_customer(db: Session, customer_id: str) -> Tenant | None:
    return (
        db.query(Tenant)
        .filter(Tenant.stripe_customer_id == customer_id)
        .one_or_none()
    )


def _get_tenant_by_metadata(db: Session, metadata: dict[str, Any]) -> Tenant | None:
    tenant_id = metadata.get("tenant_id") if isinstance(metadata, dict) else None
    if tenant_id is None:
        return None
    try:
        tenant_id_int = int(tenant_id)
    except (TypeError, ValueError):
        return None
    return db.query(Tenant).filter(Tenant.id == tenant_id_int).one_or_none()


def _provision_early_partner_entitlements(db: Session, tenant: Tenant) -> None:
    existing = {ent.key: ent for ent in tenant.entitlements}
    for key, values in EARLY_PARTNER_ENTITLEMENTS.items():
        entitlement = existing.get(key)
        if entitlement is None:
            entitlement = Entitlement(tenant_id=tenant.id, key=key)
        entitlement.bool_value = values.get("bool_value")
        entitlement.int_value = values.get("int_value")
        entitlement.str_value = values.get("str_value")
        db.add(entitlement)
    db.commit()


def _update_subscription_status(
    db: Session, tenant: Tenant, status: SubscriptionStatus
) -> None:
    if tenant.subscription_status != status:
        tenant.subscription_status_since = datetime.utcnow()
    tenant.subscription_status = status
    tenant.updated_at = datetime.utcnow()
    db.add(tenant)
    db.commit()
    db.refresh(tenant)


def handle_webhook(db: Session, payload: bytes, signature: str) -> None:
    client = _get_stripe()
    secret = settings.stripe_webhook_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe webhook secret is not configured",
        )

    try:
        event = client.Webhook.construct_event(
            payload=payload, sig_header=signature, secret=secret
        )
    except ValueError as exc:  # Invalid payload
        logger.warning("Invalid Stripe webhook payload: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid payload") from exc
    except client.error.SignatureVerificationError as exc:
        logger.warning("Invalid Stripe signature: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature") from exc

    event_type = event.get("type")
    data_object: dict[str, Any] = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        _handle_checkout_session_completed(db, data_object)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_payment_failed(db, data_object)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(db, data_object)
    else:
        logger.info("Unhandled Stripe event type: %s", event_type)


def _handle_checkout_session_completed(db: Session, session: dict[str, Any]) -> None:
    tenant = _get_tenant_by_metadata(db, session.get("metadata", {}))
    customer_id = session.get("customer")
    if tenant is None and customer_id:
        tenant = _get_tenant_by_customer(db, customer_id)

    if tenant is None:
        logger.error("No tenant associated with checkout session %s", session.get("id"))
        return

    subscription_id = session.get("subscription")
    if subscription_id:
        tenant.stripe_subscription_id = subscription_id
    if customer_id:
        tenant.stripe_customer_id = customer_id

    tenant.plan = PlanTier.EARLY_PARTNER
    _provision_early_partner_entitlements(db, tenant)
    _update_subscription_status(db, tenant, SubscriptionStatus.ACTIVE)


def _handle_invoice_payment_failed(db: Session, invoice: dict[str, Any]) -> None:
    customer_id = invoice.get("customer")
    if not customer_id:
        logger.error("Invoice without customer received: %s", invoice)
        return

    tenant = _get_tenant_by_customer(db, customer_id)
    if tenant is None:
        logger.error("Unknown tenant for Stripe customer %s", customer_id)
        return

    _update_subscription_status(db, tenant, SubscriptionStatus.PAST_DUE)


def _handle_subscription_deleted(db: Session, subscription: dict[str, Any]) -> None:
    customer_id = subscription.get("customer")
    if not customer_id:
        logger.error("Subscription deletion without customer: %s", subscription)
        return

    tenant = _get_tenant_by_customer(db, customer_id)
    if tenant is None:
        logger.error("Unknown tenant for Stripe customer %s", customer_id)
        return

    tenant.stripe_subscription_id = None
    _update_subscription_status(db, tenant, SubscriptionStatus.CANCELED)


def compute_billing_gate_status(tenant: Tenant) -> dict[str, Any]:
    status = tenant.subscription_status
    now = datetime.utcnow()
    if status == SubscriptionStatus.PAST_DUE:
        since = tenant.subscription_status_since or tenant.updated_at or tenant.created_at
        grace_days = (now - since).days
        if grace_days >= settings.billing_strict_suspension_after_days:
            return {"access": "suspended", "graceDays": grace_days}
        if grace_days >= settings.billing_read_only_after_days:
            return {"access": "read_only", "graceDays": grace_days}
        return {"access": "active", "graceDays": grace_days}
    if status in (SubscriptionStatus.CANCELED, SubscriptionStatus.PAUSED):
        return {"access": "suspended", "graceDays": None}
    return {"access": "active", "graceDays": None}


def has_entitlement(tenant: Tenant, key: str) -> bool:
    entitlement = next((ent for ent in tenant.entitlements if ent.key == key), None)
    if entitlement is None:
        return False
    if entitlement.bool_value is not None:
        return bool(entitlement.bool_value)
    return True


def get_entitlements_payload(tenant: Tenant) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for entitlement in tenant.entitlements:
        if entitlement.bool_value is not None:
            values[entitlement.key] = entitlement.bool_value
        elif entitlement.int_value is not None:
            values[entitlement.key] = entitlement.int_value
        elif entitlement.str_value is not None:
            values[entitlement.key] = entitlement.str_value
        else:
            values[entitlement.key] = True
    return values


def ensure_early_partner_seed(db: Session, tenant: Tenant) -> None:
    tenant.plan = PlanTier.EARLY_PARTNER
    _provision_early_partner_entitlements(db, tenant)
    _update_subscription_status(db, tenant, SubscriptionStatus.ACTIVE)
