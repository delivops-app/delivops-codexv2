from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, ConfigDict


class ShopifySubscriptionPeriod(BaseModel):
    start_at: datetime | None = Field(default=None, alias="start_at")
    end_at: datetime | None = Field(default=None, alias="end_at")


class ShopifySubscriptionWebhook(BaseModel):
    event_id: str = Field(..., description="Unique identifier of the webhook delivery")
    subscription_id: str = Field(..., description="Shopify subscription identifier")
    tenant_slug: str = Field(..., description="Slug used to map the webhook to a tenant")
    shopify_plan_id: str = Field(..., description="Identifier of the purchased plan")
    max_chauffeurs: int = Field(
        ..., ge=0, description="Quota of chauffeurs unlocked by the subscription"
    )
    status: str = Field(..., description="Subscription status reported by Shopify")
    period: ShopifySubscriptionPeriod | None = Field(
        default=None, description="Current billing period information"
    )
    metadata: dict[str, Any] | None = Field(
        default=None, description="Additional metadata attached to the subscription"
    )

    model_config = ConfigDict(populate_by_name=True)
