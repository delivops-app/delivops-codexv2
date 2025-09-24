import pytest
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
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
        json={"name": "Cat A", "unitPriceExVat": "12.34"},
        headers=headers_admin,
    )
    assert resp.status_code == 201
    created_category = resp.json()
    assert Decimal(str(created_category["unitPriceExVat"])) == Decimal("12.34")
    category_id = created_category["id"]

    with TestingSessionLocal() as db:
        tariff = (
            db.query(Tariff)
            .filter(Tariff.tariff_group_id == category_id)
            .one()
        )
        assert tariff.price_ex_vat == Decimal("12.34")
        assert tariff.effective_from == date.today()

    resp = client.get("/clients/", headers=headers_driver)
    assert resp.status_code == 200
    data = resp.json()
    assert any(
        c["name"] == "Client X"
        and c["isActive"] is True
        and c["categories"]
        and c["categories"][0]["name"] == "Cat A"
        and Decimal(c["categories"][0]["unitPriceExVat"]) == Decimal("12.34")
        for c in data
    )


def test_update_category_updates_tariff_price(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-update-cat")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}

    resp = client.post("/clients/", json={"name": "Client Y"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={"name": "Initial", "unitPriceExVat": "5.00"},
        headers=headers_admin,
    )
    assert resp.status_code == 201
    category_payload = resp.json()
    category_id = category_payload["id"]

    with TestingSessionLocal() as db:
        initial_tariff = (
            db.query(Tariff)
            .filter(Tariff.tariff_group_id == category_id)
            .one()
        )
        initial_tariff_id = initial_tariff.id
        initial_effective_from = initial_tariff.effective_from

    resp = client.patch(
        f"/clients/{client_id}/categories/{category_id}",
        json={"name": "Updated", "unitPriceExVat": "7.50"},
        headers=headers_admin,
    )
    assert resp.status_code == 200
    updated_payload = resp.json()
    assert updated_payload["name"] == "Updated"
    assert Decimal(str(updated_payload["unitPriceExVat"])) == Decimal("7.50")

    with TestingSessionLocal() as db:
        updated_tariff = (
            db.query(Tariff)
            .filter(Tariff.tariff_group_id == category_id)
            .one()
        )
        assert updated_tariff.id == initial_tariff_id
        assert updated_tariff.effective_from == initial_effective_from
        assert updated_tariff.price_ex_vat == Decimal("7.50")


def test_create_client_missing_tenant_returns_404(client):
    headers_admin = {"X-Tenant-Id": "999", "X-Dev-Role": "ADMIN"}
    resp = client.post("/clients/", json={"name": "Test"}, headers=headers_admin)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Tenant not found"


def test_delete_client_marks_client_and_categories_inactive(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-delete")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}

    resp = client.post("/clients/", json={"name": "Client Z"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={"name": "Cat Z"},
        headers=headers_admin,
    )
    assert resp.status_code == 201
    category_id = resp.json()["id"]

    resp = client.delete(f"/clients/{client_id}", headers=headers_admin)
    assert resp.status_code == 204

    with TestingSessionLocal() as db:
        db_client = db.get(Client, client_id)
        assert db_client is not None
        assert db_client.is_active is False

        db_group = db.get(TariffGroup, category_id)
        assert db_group is not None
        assert db_group.is_active is False


def test_list_clients_include_inactive_flag(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-include-inactive")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}

    resp = client.post("/clients/", json={"name": "Client Active"}, headers=headers_admin)
    assert resp.status_code == 201

    resp = client.post("/clients/", json={"name": "Client Inactive"}, headers=headers_admin)
    assert resp.status_code == 201
    inactive_id = resp.json()["id"]

    resp = client.delete(f"/clients/{inactive_id}", headers=headers_admin)
    assert resp.status_code == 204

    resp = client.get("/clients/", headers=headers_admin)
    assert resp.status_code == 200
    default_data = resp.json()
    assert len(default_data) == 1
    assert default_data[0]["name"] == "Client Active"
    assert default_data[0]["isActive"] is True

    resp = client.get("/clients/?include_inactive=true", headers=headers_admin)
    assert resp.status_code == 200
    data = {entry["name"]: entry["isActive"] for entry in resp.json()}
    assert data == {"Client Active": True, "Client Inactive": False}

