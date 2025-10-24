from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.tenant import PlanTier, SubscriptionStatus


class CheckoutSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: int = Field(alias="organizationId")


class PortalSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    organization_id: int = Field(alias="organizationId")


class BillingActionResponse(BaseModel):
    url: str


class BillingGate(BaseModel):
    access: Literal["active", "read_only", "suspended"]
    grace_days: int | None = Field(default=None, alias="graceDays")

    model_config = ConfigDict(populate_by_name=True)


class BillingStateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    plan: PlanTier
    subscription_status: SubscriptionStatus = Field(alias="subscriptionStatus")
    entitlements: dict[str, Any]
    gate: BillingGate
    stripe_portal_return_url: str | None = Field(
        default=None, alias="stripePortalReturnUrl"
    )
