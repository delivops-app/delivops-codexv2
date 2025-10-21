import pytest
import uuid
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
from app.models.tour import Tour
from app.models.tour_item import TourItem
from app.models.chauffeur import Chauffeur
from app.models.user import User
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
    try:
        with TestClient(app) as c:
            yield c
    finally:
        if previous_override is not None:
            app.dependency_overrides[get_db] = previous_override
        else:
            app.dependency_overrides.pop(get_db, None)


def _create_admin_user(db, tenant_id: int) -> str:
    identifier = uuid.uuid4().hex
    sub = f"auth0|admin-{identifier}"
    admin = User(
        tenant_id=tenant_id,
        auth0_sub=sub,
        email=f"admin-{identifier}@example.com",
        role="ADMIN",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    return sub


def test_list_clients_requires_admin_role(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme6")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    headers_driver = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "CHAUFFEUR"}

    resp = client.post("/clients/", json={"name": "Client X"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={
            "name": "Cat A",
            "unitPriceExVat": "12.34",
            "marginExVat": "2.50",
        },
        headers=headers_admin,
    )
    assert resp.status_code == 201
    created_category = resp.json()
    assert Decimal(str(created_category["unitPriceExVat"])) == Decimal("12.34")
    assert Decimal(str(created_category["marginExVat"])) == Decimal("2.50")
    category_id = created_category["id"]

    with TestingSessionLocal() as db:
        tariff = (
            db.query(Tariff)
            .filter(Tariff.tariff_group_id == category_id)
            .one()
        )
        assert tariff.price_ex_vat == Decimal("12.34")
        assert tariff.margin_ex_vat == Decimal("2.50")
        assert tariff.effective_from == date.today()

    resp = client.get("/clients/", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert any(
        c["name"] == "Client X"
        and c["isActive"] is True
        and c["categories"]
        and c["categories"][0]["name"] == "Cat A"
        and Decimal(c["categories"][0]["unitPriceExVat"]) == Decimal("12.34")
        and Decimal(c["categories"][0]["marginExVat"]) == Decimal("2.50")
        for c in data
    )

    resp = client.get("/clients/", headers=headers_driver)
    assert resp.status_code == 403


def test_client_routes_accept_tenant_slug(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Slug Tenant", slug="slug-tenant")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        admin_sub = _create_admin_user(db, tenant.id)
        slug_header = tenant.slug.upper()

    headers_admin = {
        "X-Tenant-Id": slug_header,
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }

    resp = client.post("/clients/", json={"name": "Slug Client"}, headers=headers_admin)
    assert resp.status_code == 201

    resp = client.get("/clients/", headers=headers_admin)
    assert resp.status_code == 200
    assert any(entry["name"] == "Slug Client" for entry in resp.json())


def test_update_category_updates_tariff_price(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-update-cat")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }

    resp = client.post("/clients/", json={"name": "Client Y"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={
            "name": "Initial",
            "unitPriceExVat": "5.00",
            "marginExVat": "1.00",
        },
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
        json={
            "name": "Updated",
            "unitPriceExVat": "7.50",
            "marginExVat": "1.50",
        },
        headers=headers_admin,
    )
    assert resp.status_code == 200
    updated_payload = resp.json()
    assert updated_payload["name"] == "Updated"
    assert Decimal(str(updated_payload["unitPriceExVat"])) == Decimal("7.50")
    assert Decimal(str(updated_payload["marginExVat"])) == Decimal("1.50")

    with TestingSessionLocal() as db:
        updated_tariff = (
            db.query(Tariff)
            .filter(Tariff.tariff_group_id == category_id)
            .one()
        )
        assert updated_tariff.id == initial_tariff_id
        assert updated_tariff.effective_from == initial_effective_from
        assert updated_tariff.price_ex_vat == Decimal("7.50")
        assert updated_tariff.margin_ex_vat == Decimal("1.50")


def test_create_client_missing_tenant_returns_404(client):
    headers_admin = {
        "X-Tenant-Id": "999",
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": "auth0|admin-missing",
    }
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
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }

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
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }

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


def test_reactivate_client_restores_client_and_categories(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-reactivate")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        tenant_id = tenant.id
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }

    resp = client.post("/clients/", json={"name": "Client React"}, headers=headers_admin)
    assert resp.status_code == 201
    client_id = resp.json()["id"]

    resp = client.post(
        f"/clients/{client_id}/categories",
        json={"name": "React Cat"},
        headers=headers_admin,
    )
    assert resp.status_code == 201
    category_id = resp.json()["id"]

    resp = client.delete(f"/clients/{client_id}", headers=headers_admin)
    assert resp.status_code == 204

    resp = client.post(f"/clients/{client_id}/reactivate", headers=headers_admin)
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["isActive"] is True
    assert payload["categories"]
    assert payload["categories"][0]["id"] == category_id

    with TestingSessionLocal() as db:
        db_client = db.get(Client, client_id)
        assert db_client is not None
        assert db_client.is_active is True
        db_group = db.get(TariffGroup, category_id)
        assert db_group is not None
        assert db_group.is_active is True


def test_client_history_returns_clients_with_declarations(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme-history")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        chauffeur = Chauffeur(
            tenant_id=tenant.id,
            email="driver@example.com",
            display_name="Driver",
        )
        client_active = Client(
            tenant_id=tenant.id,
            name="Client Hist A",
            is_active=True,
        )
        client_inactive = Client(
            tenant_id=tenant.id,
            name="Client Hist B",
            is_active=True,
        )
        db.add_all([chauffeur, client_active, client_inactive])
        db.commit()
        db.refresh(chauffeur)
        db.refresh(client_active)
        db.refresh(client_inactive)

        tg_active = TariffGroup(
            tenant_id=tenant.id,
            client_id=client_active.id,
            code="A",
            display_name="A",
            unit="COLIS",
            order=0,
            is_active=True,
        )
        tg_inactive = TariffGroup(
            tenant_id=tenant.id,
            client_id=client_inactive.id,
            code="B",
            display_name="B",
            unit="COLIS",
            order=0,
            is_active=True,
        )
        db.add_all([tg_active, tg_inactive])
        db.commit()
        db.refresh(tg_active)
        db.refresh(tg_inactive)

        tour_a = Tour(
            tenant_id=tenant.id,
            driver_id=chauffeur.id,
            client_id=client_active.id,
            date=date(2023, 4, 5),
            status=Tour.STATUS_COMPLETED,
        )
        tour_b1 = Tour(
            tenant_id=tenant.id,
            driver_id=chauffeur.id,
            client_id=client_inactive.id,
            date=date(2023, 6, 15),
            status=Tour.STATUS_COMPLETED,
        )
        tour_b2 = Tour(
            tenant_id=tenant.id,
            driver_id=chauffeur.id,
            client_id=client_inactive.id,
            date=date(2023, 5, 10),
            status=Tour.STATUS_COMPLETED,
        )
        db.add_all([tour_a, tour_b1, tour_b2])
        db.commit()
        db.refresh(tour_a)
        db.refresh(tour_b1)
        db.refresh(tour_b2)

        db.add_all(
            [
                TourItem(
                    tenant_id=tenant.id,
                    tour_id=tour_a.id,
                    tariff_group_id=tg_active.id,
                    pickup_quantity=5,
                    delivery_quantity=4,
                ),
                TourItem(
                    tenant_id=tenant.id,
                    tour_id=tour_b1.id,
                    tariff_group_id=tg_inactive.id,
                    pickup_quantity=7,
                    delivery_quantity=7,
                ),
                TourItem(
                    tenant_id=tenant.id,
                    tour_id=tour_b2.id,
                    tariff_group_id=tg_inactive.id,
                    pickup_quantity=3,
                    delivery_quantity=1,
                ),
            ]
        )
        client_inactive.is_active = False
        tg_inactive.is_active = False
        db.commit()
        tenant_id = tenant.id
        admin_sub = _create_admin_user(db, tenant_id)

    headers_admin = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    resp = client.get("/clients/history", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()

    assert [entry["name"] for entry in data] == [
        "Client Hist B",
        "Client Hist A",
    ]

    hist_b = data[0]
    assert hist_b["isActive"] is False
    assert hist_b["lastDeclarationDate"] == "2023-06-15"
    assert hist_b["declarationCount"] == 2

    hist_a = data[1]
    assert hist_a["isActive"] is True
    assert hist_a["lastDeclarationDate"] == "2023-04-05"
    assert hist_a["declarationCount"] == 1


def test_admin_cannot_switch_tenant_scope(client):
    with TestingSessionLocal() as db:
        tenant_primary = Tenant(name="Tenant Primary", slug="tenant-primary")
        tenant_other = Tenant(name="Tenant Other", slug="tenant-other")
        db.add_all([tenant_primary, tenant_other])
        db.commit()
        db.refresh(tenant_primary)
        db.refresh(tenant_other)
        primary_id = tenant_primary.id
        other_id = tenant_other.id
        primary_sub = _create_admin_user(db, primary_id)

    headers_primary = {
        "X-Tenant-Id": str(primary_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": primary_sub,
    }
    resp = client.get("/clients/", headers=headers_primary)
    assert resp.status_code == 200

    headers_other = {
        "X-Tenant-Id": str(other_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": primary_sub,
    }
    resp = client.get("/clients/", headers=headers_other)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "User not associated with tenant"
