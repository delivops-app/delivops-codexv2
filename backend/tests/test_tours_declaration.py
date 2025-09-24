from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.session import get_db
from app.main import app
from app.models.base import Base
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff import Tariff
from app.models.tariff_group import TariffGroup
from app.models.tour import Tour
from app.models.tenant import Tenant
from app.models.user import User

engine = create_engine(
    "sqlite://",
    future=True,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    bind=engine, autocommit=False, autoflush=False, future=True
)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    settings.dev_fake_auth = True

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


def _seed(db):
    tenant = Tenant(name="Acme", slug="acme")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    user_driver = User(
        tenant_id=tenant.id,
        auth0_sub="dev|driver1",
        email="driver@example.com",
        role="CHAUFFEUR",
    )
    db.add(user_driver)
    db.commit()
    db.refresh(user_driver)

    chauffeur = Chauffeur(
        tenant_id=tenant.id,
        user_id=user_driver.id,
        email="driver@example.com",
        display_name="Ali",
    )
    client_model = Client(tenant_id=tenant.id, name="Amazon")
    db.add_all([chauffeur, client_model])
    db.commit()
    db.refresh(chauffeur)
    db.refresh(client_model)

    tg = TariffGroup(
        tenant_id=tenant.id,
        client_id=client_model.id,
        code="tg_STD",
        display_name="Colis standards",
        unit="colis",
        order=1,
    )
    db.add(tg)
    db.commit()
    db.refresh(tg)

    tariff_current = Tariff(
        tenant_id=tenant.id,
        tariff_group_id=tg.id,
        price_ex_vat=Decimal("3.00"),
        margin_ex_vat=Decimal("1.20"),
        vat_rate=Decimal("0.20"),
        effective_from=date.today() - timedelta(days=1),
    )
    tariff_old = Tariff(
        tenant_id=tenant.id,
        tariff_group_id=tg.id,
        price_ex_vat=Decimal("2.00"),
        margin_ex_vat=Decimal("0.80"),
        vat_rate=Decimal("0.20"),
        effective_from=date.today() - timedelta(days=10),
        effective_to=date.today() - timedelta(days=2),
    )
    db.add_all([tariff_current, tariff_old])
    db.commit()

    return tenant.id, chauffeur.id, client_model.id, tg.id


def test_create_pickup_and_close_tour(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }

    pickup_payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "pickupQuantity": 5}],
    }
    pickup_response = client.post("/tours/pickup", json=pickup_payload, headers=headers)
    assert pickup_response.status_code == 201
    pickup_data = pickup_response.json()
    assert pickup_data["totals"]["pickupQty"] == 5
    assert pickup_data["totals"]["deliveryQty"] == 0
    assert Decimal(pickup_data["items"][0]["unitPriceExVat"]) == Decimal("3.00")
    assert Decimal(pickup_data["items"][0]["amountExVat"]) == Decimal("0.00")
    assert Decimal(pickup_data["items"][0]["unitMarginExVat"]) == Decimal("1.20")
    assert Decimal(pickup_data["items"][0]["marginAmountEur"]) == Decimal("0.00")
    assert Decimal(pickup_data["totals"]["marginAmountEur"]) == Decimal("0.00")

    delivery_payload = {
        "items": [{"tariffGroupId": tg_id, "deliveryQuantity": 4}]
    }
    delivery_response = client.put(
        f"/tours/{pickup_data['tourId']}/delivery",
        json=delivery_payload,
        headers=headers,
    )
    assert delivery_response.status_code == 200
    delivery_data = delivery_response.json()
    assert delivery_data["totals"]["pickupQty"] == 5
    assert delivery_data["totals"]["deliveryQty"] == 4
    assert Decimal(delivery_data["items"][0]["amountExVat"]) == Decimal("12.00")
    assert Decimal(delivery_data["items"][0]["unitMarginExVat"]) == Decimal("1.20")
    assert Decimal(delivery_data["items"][0]["marginAmountEur"]) == Decimal("4.80")
    assert Decimal(delivery_data["totals"]["marginAmountEur"]) == Decimal("4.80")
    assert delivery_data["status"] == "COMPLETED"


def test_create_pickup_rejects_tariff_group_from_other_client(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)
        other_client = Client(tenant_id=tenant_id, name="Globex")
        db.add(other_client)
        db.commit()
        db.refresh(other_client)

        other_tg = TariffGroup(
            tenant_id=tenant_id,
            client_id=other_client.id,
            code="tg_OTHER",
            display_name="Colis autres",
            unit="colis",
            order=2,
        )
        db.add(other_tg)
        db.commit()
        db.refresh(other_tg)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": other_tg.id, "pickupQuantity": 1}],
    }

    response = client.post("/tours/pickup", json=payload, headers=headers)

    assert response.status_code == 400
    assert response.json()["detail"] == "Tariff group not available for this client"


def test_report_declarations(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    pickup_payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "pickupQuantity": 2}],
    }
    pickup_resp = client.post("/tours/pickup", json=pickup_payload, headers=headers)
    tour_id = pickup_resp.json()["tourId"]

    delivery_payload = {
        "items": [{"tariffGroupId": tg_id, "deliveryQuantity": 2}]
    }
    client.put(
        f"/tours/{tour_id}/delivery",
        json=delivery_payload,
        headers=headers,
    )

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    resp = client.get("/reports/declarations", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["tourId"] > 0
    assert data[0]["tourItemId"] is not None
    assert data[0]["pickupQuantity"] == 2
    assert data[0]["deliveryQuantity"] == 2
    assert data[0]["differenceQuantity"] == 0
    assert data[0]["unitPriceExVat"] == "3.00"
    assert data[0]["estimatedAmountEur"] == "6.00"
    assert data[0]["unitMarginExVat"] == "1.20"
    assert data[0]["marginAmountEur"] == "2.40"
    assert data[0]["status"] == "COMPLETED"


def test_report_declarations_includes_in_progress(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers_driver = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    pickup_payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "pickupQuantity": 3}],
    }
    pickup_resp = client.post("/tours/pickup", json=pickup_payload, headers=headers_driver)
    assert pickup_resp.status_code == 201

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    resp = client.get("/reports/declarations", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["pickupQuantity"] == 3
    assert data[0]["deliveryQuantity"] == 0
    assert data[0]["unitMarginExVat"] == "1.20"
    assert data[0]["marginAmountEur"] == "0.00"
    assert data[0]["status"] == "IN_PROGRESS"


def test_report_declarations_includes_in_progress_without_items(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, _ = _seed(db)
        tour = Tour(
            tenant_id=tenant_id,
            driver_id=chauffeur_id,
            client_id=client_id,
            date=date.today(),
            status=Tour.STATUS_IN_PROGRESS,
        )
        db.add(tour)
        db.commit()

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    resp = client.get("/reports/declarations", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["tourItemId"] is None
    assert data[0]["pickupQuantity"] == 0
    assert data[0]["deliveryQuantity"] == 0
    assert data[0]["tariffGroupDisplayName"] == "—"
    assert data[0]["unitMarginExVat"] == "0.00"
    assert data[0]["marginAmountEur"] == "0.00"
    assert data[0]["status"] == "IN_PROGRESS"



def test_admin_updates_declaration(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers_driver = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    pickup_payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "pickupQuantity": 3}],
    }
    pickup_resp = client.post(
        "/tours/pickup", json=pickup_payload, headers=headers_driver
    )
    tour_id = pickup_resp.json()["tourId"]

    delivery_payload = {
        "items": [{"tariffGroupId": tg_id, "deliveryQuantity": 1}]
    }
    client.put(
        f"/tours/{tour_id}/delivery",
        json=delivery_payload,
        headers=headers_driver,
    )

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    report_resp = client.get("/reports/declarations", headers=headers_admin)
    tour_item_id = report_resp.json()[0]["tourItemId"]

    assert tour_item_id is not None

    assert report_resp.json()[0]["status"] == "COMPLETED"

    update_payload = {
        "pickupQuantity": 4,
        "deliveryQuantity": 2,
        "estimatedAmountEur": "25.50",
    }
    update_resp = client.put(
        f"/reports/declarations/{tour_item_id}",
        json=update_payload,
        headers=headers_admin,
    )
    assert update_resp.status_code == 200
    updated = update_resp.json()
    assert updated["pickupQuantity"] == 4
    assert updated["deliveryQuantity"] == 2
    assert updated["differenceQuantity"] == 2
    assert updated["estimatedAmountEur"] == "25.50"
    assert updated["unitPriceExVat"] == "3.00"
    assert updated["unitMarginExVat"] == "1.20"
    assert updated["marginAmountEur"] == "2.40"
    assert updated["status"] == "COMPLETED"

    invalid_payload = {
        "pickupQuantity": 2,
        "deliveryQuantity": 3,
    }
    invalid_resp = client.put(
        f"/reports/declarations/{tour_item_id}",
        json=invalid_payload,
        headers=headers_admin,
    )
    assert invalid_resp.status_code == 400
    assert (
        invalid_resp.json()["detail"]
        == "Delivered quantity cannot exceed picked up quantity"
    )


def test_admin_creates_declaration(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    payload = {
        "date": date.today().isoformat(),
        "driverId": chauffeur_id,
        "clientId": client_id,
        "tariffGroupId": tg_id,
        "pickupQuantity": 5,
        "deliveryQuantity": 4,
    }

    create_resp = client.post(
        "/reports/declarations", json=payload, headers=headers_admin
    )
    assert create_resp.status_code == 201
    created = create_resp.json()
    assert created["pickupQuantity"] == 5
    assert created["deliveryQuantity"] == 4
    assert created["differenceQuantity"] == 1
    assert created["unitPriceExVat"] == "3.00"
    assert created["estimatedAmountEur"] == "12.00"
    assert created["unitMarginExVat"] == "1.20"
    assert created["marginAmountEur"] == "4.80"
    assert created["status"] == "COMPLETED"

    duplicate_resp = client.post(
        "/reports/declarations", json=payload, headers=headers_admin
    )
    assert duplicate_resp.status_code == 400
    assert (
        duplicate_resp.json()["detail"]
        == "A declaration already exists for this tariff group on this tour"
    )

    custom_amount_payload = {
        **payload,
        "date": (date.today() - timedelta(days=1)).isoformat(),
        "estimatedAmountEur": "42.00",
    }
    custom_resp = client.post(
        "/reports/declarations", json=custom_amount_payload, headers=headers_admin
    )
    assert custom_resp.status_code == 201
    created_custom = custom_resp.json()
    assert created_custom["estimatedAmountEur"] == "42.00"
    assert created_custom["unitMarginExVat"] == "1.20"
    assert created_custom["marginAmountEur"] == "4.80"
    assert created_custom["status"] == "COMPLETED"


def test_admin_deletes_declaration(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers_driver = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    pickup_payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "pickupQuantity": 2}],
    }
    pickup_resp = client.post(
        "/tours/pickup", json=pickup_payload, headers=headers_driver
    )
    tour_id = pickup_resp.json()["tourId"]

    delivery_payload = {
        "items": [{"tariffGroupId": tg_id, "deliveryQuantity": 1}]
    }
    client.put(
        f"/tours/{tour_id}/delivery",
        json=delivery_payload,
        headers=headers_driver,
    )

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    report_resp = client.get("/reports/declarations", headers=headers_admin)
    assert report_resp.status_code == 200
    tour_item_id = report_resp.json()[0]["tourItemId"]

    delete_resp = client.delete(
        f"/reports/declarations/{tour_item_id}", headers=headers_admin
    )
    assert delete_resp.status_code == 204

    after_delete = client.get("/reports/declarations", headers=headers_admin)
    assert after_delete.status_code == 200
    assert after_delete.json() == []
