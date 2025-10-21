from __future__ import annotations

import base64
import hashlib
import hmac
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.schemas.subscription import ShopifySubscriptionWebhook
from app.services.subscriptions import (
    ShopifyProcessingOutcome,
    ShopifySubscriptionService,
    TenantSubscriptionNotFoundError,
)

router = APIRouter(prefix="/integrations/shopify", tags=["shopify"])


@router.post("/webhooks/subscription")
async def handle_shopify_subscription(
    request: Request, db: Session = Depends(get_db)
) -> dict[str, Any]:
    raw_body = await request.body()
    _verify_signature(raw_body, request.headers.get("X-Shopify-Hmac-Sha256"))

    try:
        payload_dict = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from exc

    payload = ShopifySubscriptionWebhook.model_validate(payload_dict)
    service = ShopifySubscriptionService(db)

    try:
        outcome: ShopifyProcessingOutcome = service.process_webhook(
            payload, request.headers.get("X-Shopify-Topic")
        )
    except TenantSubscriptionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    status_label = "ignored" if outcome.duplicate else "updated"
    subscription = outcome.subscription

    return {
        "status": status_label,
        "tenant_id": outcome.tenant.id,
        "tenant_slug": outcome.tenant.slug,
        "shopify_subscription_id": getattr(subscription, "shopify_subscription_id", None),
        "max_chauffeurs": outcome.tenant.max_chauffeurs,
    }


def _verify_signature(raw_body: bytes, signature_header: str | None) -> None:
    secret = settings.shopify_webhook_secret
    if not secret:
        if signature_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Shopify webhook secret not configured",
            )
        return

    if not signature_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Shopify HMAC header",
        )

    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    expected_signature = base64.b64encode(digest).decode("utf-8")
    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Shopify HMAC signature",
        )
