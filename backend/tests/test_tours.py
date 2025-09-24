import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.user import User
from app.models.chauffeur import Chauffeur
from app.core.config import settings


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
settings.dev_fake_auth = True


@pytest.fixture
def client():
    previous_override = app.dependency_overrides.get(get_db)

    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    if previous_override is not None:
        app.dependency_overrides[get_db] = previous_override
    else:
        app.dependency_overrides.pop(get_db, None)


def test_driver_request_updates_last_seen_timestamp(client):

    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-driver")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        user = User(
            tenant_id=tenant.id,
            auth0_sub="auth0|driver",
            email="driver@example.com",
            role="CHAUFFEUR",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        chauffeur = Chauffeur(
            tenant_id=tenant.id,
            email="chauffeur@example.com",
            display_name="Driver",
            user_id=user.id,
        )
        db.add(chauffeur)
        db.commit()
        db.refresh(chauffeur)

        tenant_id = tenant.id
        chauffeur_id = chauffeur.id
        auth_sub = user.auth0_sub
        assert chauffeur.last_seen_at is None

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": auth_sub,
    }

    response = client.get("/tours/pending", headers=headers)
    assert response.status_code == 200

    with TestingSessionLocal() as db:
        updated = db.get(Chauffeur, chauffeur_id)
        assert updated is not None
        assert updated.last_seen_at is not None
