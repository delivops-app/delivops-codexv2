from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, selectinload

from app.api.deps import auth_dependency, get_tenant_id
from app.core.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant
from app.schemas.billing import (
    BillingActionResponse,
    BillingStateResponse,
    CheckoutSessionRequest,
    PortalSessionRequest,
)
from app.services import billing as billing_service

router = APIRouter(prefix="/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/stripe", tags=["stripe"])


@router.post("/create-checkout-session", response_model=BillingActionResponse)
def create_checkout_session(
    payload: CheckoutSessionRequest,
    tenant_id: int = Depends(get_tenant_id),
    db: Session = Depends(get_db),
    _: dict = Depends(auth_dependency),
) -> BillingActionResponse:
    if payload.organization_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization mismatch",
        )

    tenant = (
        db.query(Tenant)
        .options(selectinload(Tenant.entitlements))
        .filter(Tenant.id == tenant_id)
        .one_or_none()
    )
    if tenant is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    url = billing_service.create_checkout_session(db, tenant)
    return BillingActionResponse(url=url)


@router.post("/portal", response_model=BillingActionResponse)
def create_customer_portal_session(
    payload: PortalSessionRequest,
    tenant_id: int = Depends(get_tenant_id),
    db: Session = Depends(get_db),
    _: dict = Depends(auth_dependency),
) -> BillingActionResponse:
    if payload.organization_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization mismatch",
        )

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    url = billing_service.create_customer_portal_session(tenant)
    return BillingActionResponse(url=url)


@router.get("/state", response_model=BillingStateResponse)
def get_billing_state(
    tenant_id: int = Depends(get_tenant_id),
    db: Session = Depends(get_db),
    _: dict = Depends(auth_dependency),
) -> BillingStateResponse:
    tenant = (
        db.query(Tenant)
        .options(selectinload(Tenant.entitlements))
        .filter(Tenant.id == tenant_id)
        .one_or_none()
    )
    if tenant is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    entitlements = billing_service.get_entitlements_payload(tenant)
    gate = billing_service.compute_billing_gate_status(tenant)
    return BillingStateResponse(
        plan=tenant.plan,
        subscription_status=tenant.subscription_status,
        entitlements=entitlements,
        gate=gate,
        stripe_portal_return_url=settings.stripe_customer_portal_return_url,
    )


@webhook_router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    signature = request.headers.get("stripe-signature")
    if signature is None:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    payload = await request.body()
    billing_service.handle_webhook(db, payload, signature)
    return {"status": "received"}


__all__ = ["router", "webhook_router"]
