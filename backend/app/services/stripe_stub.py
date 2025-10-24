"""Utilities to stub the Stripe SDK for local simulations and tests."""

from __future__ import annotations


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


__all__ = ["DummyStripe"]

