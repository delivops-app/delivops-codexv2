import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.tenant import Tenant
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
    def override_get_db():
        try:
            db = TestingSessionLocal()
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_create_client_and_category_visible_to_driver(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme6")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    headers_driver = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "CHAUFFEUR"}

    resp = client.post("/clients/", json={"name": "Client X"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={"name": "Cat A"},
        headers=headers_admin,
    )
    assert resp.status_code == 201

    resp = client.get("/clients/", headers=headers_driver)
    assert resp.status_code == 200
    data = resp.json()
    assert any(
        c["name"] == "Client X" and c["categories"] and c["categories"][0]["name"] == "Cat A"
        for c in data
    )

