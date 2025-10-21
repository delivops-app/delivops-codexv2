from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.audit import AuditLog
from app.models.base import Base
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant, TenantSubscription
from app.models.user import User


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


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
app.dependency_overrides[get_db] = override_get_db
settings.dev_fake_auth = True


def create_tenant(db, slug: str, max_chauffeurs: int) -> Tenant:
    tenant = Tenant(name="Delivops", slug=slug, max_chauffeurs=max_chauffeurs)
    subscription = TenantSubscription(
        tenant=tenant,
        shopify_plan_id=f"plan-{slug}",
        max_chauffeurs=max_chauffeurs,
        status="active",
        period=None,
        metadata=None,
    )
    tenant.active_subscription = subscription
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def test_monitoring_overview_provides_aggregated_metrics():
    client = TestClient(app)

    with TestingSessionLocal() as db:
        tenant = create_tenant(db, "monitor", 10)
        tenant_id = tenant.id

        admin_active = User(
            tenant_id=tenant.id,
            auth0_sub="auth0|admin-active",
            email="admin-active@example.com",
            role="ADMIN",
            is_active=True,
        )
        admin_inactive = User(
            tenant_id=tenant.id,
            auth0_sub="auth0|admin-inactive",
            email="admin-inactive@example.com",
            role="ADMIN",
            is_active=False,
        )
        db.add_all([admin_active, admin_inactive])
        db.commit()
        db.refresh(admin_active)
        db.refresh(admin_inactive)

        chauffeur_recent = Chauffeur(
            tenant_id=tenant.id,
            email="driver.recent@example.com",
            display_name="Driver Recent",
            is_active=True,
            last_seen_at=datetime.utcnow(),
        )
        chauffeur_inactive = Chauffeur(
            tenant_id=tenant.id,
            email="driver.inactive@example.com",
            display_name="Driver Inactive",
            is_active=False,
            last_seen_at=datetime.utcnow() - timedelta(days=2),
        )
        db.add_all([chauffeur_recent, chauffeur_inactive])
        db.commit()

        audit_admin = AuditLog(
            tenant_id=tenant.id,
            user_id=admin_active.id,
            entity="/chauffeurs/42",
            entity_id=42,
            action="post",
            created_at=datetime.utcnow() - timedelta(minutes=5),
        )
        audit_public = AuditLog(
            tenant_id=tenant.id,
            user_id=None,
            entity="/healthz",
            entity_id=0,
            action="get",
            created_at=datetime.utcnow() - timedelta(minutes=1),
        )
        db.add_all([audit_admin, audit_public])
        db.commit()

    headers = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "GLOBAL_SUPERVISION"}

    response = client.get("/monitoring/overview", headers=headers)
    assert response.status_code == 200

    payload = response.json()

    assert payload["admins"]["total"] == 2
    assert payload["admins"]["active"] == 1
    assert payload["admins"]["inactive"] == 1
    assert payload["chauffeurs"]["total"] == 2
    assert payload["chauffeurs"]["active"] == 1
    assert payload["chauffeurs"]["inactive"] == 1
    assert payload["chauffeurs"]["active_last_24h"] == 1
    assert payload["gdpr_notice"]

    entities = {event["entity"] for event in payload["recent_events"]}
    assert "/chauffeurs/:id" in entities
    assert any(event["actor_role"] == "ADMIN" for event in payload["recent_events"])
    assert any(event["actor_role"] == "ANONYMOUS" for event in payload["recent_events"])


def test_monitoring_overview_is_forbidden_for_admin_role():
    client = TestClient(app)

    with TestingSessionLocal() as db:
        tenant = create_tenant(db, "forbidden", 1)
        tenant_id = tenant.id

    headers = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}

    response = client.get("/monitoring/overview", headers=headers)

    assert response.status_code == 403
