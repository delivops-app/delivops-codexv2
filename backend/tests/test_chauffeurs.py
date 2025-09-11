from fastapi.testclient import TestClient
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.chauffeur import Chauffeur
from app.models.user import User
from app.core.config import settings


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
TestingSessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
Base.metadata.create_all(bind=engine)
app.dependency_overrides[get_db] = override_get_db
settings.dev_fake_auth = True


def test_create_chauffeur_and_limit(monkeypatch):
    sent = {}

    def fake_send(email: str, link: str) -> None:
        sent["email"] = email
        sent["link"] = link

    monkeypatch.setattr("app.api.chauffeurs.send_activation_email", fake_send)

    client = TestClient(app)

    # create tenant
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme", max_chauffeurs=1)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    headers = {"X-Tenant-Id": str(tenant_id)}

    # create first chauffeur
    response = client.post(
        "/chauffeurs/",
        json={"email": "driver1@example.com", "display_name": "Driver One"},
        headers=headers,
    )
    assert response.status_code == 201
    assert sent["email"] == "driver1@example.com"
    assert "activate" in sent["link"]

    # count should be 1 and reflect subscription
    response = client.get("/chauffeurs/count", headers=headers)
    assert response.status_code == 200
    assert response.json() == {"count": 1, "subscribed": 1}

    # second chauffeur exceeds limit
    response = client.post(
        "/chauffeurs/",
        json={"email": "driver2@example.com", "display_name": "Driver Two"},
        headers=headers,
    )
    assert response.status_code == 400
