from datetime import date, timedelta
from decimal import Decimal

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
from app.models.client import Client
from app.models.tariff_group import TariffGroup
from app.models.tariff import Tariff

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
        vat_rate=Decimal("0.20"),
        effective_from=date.today() - timedelta(days=1),
    )
    tariff_old = Tariff(
        tenant_id=tenant.id,
        tariff_group_id=tg.id,
        price_ex_vat=Decimal("2.00"),
        vat_rate=Decimal("0.20"),
        effective_from=date.today() - timedelta(days=10),
        effective_to=date.today() - timedelta(days=2),
    )
    db.add_all([tariff_current, tariff_old])
    db.commit()

    return tenant.id, chauffeur.id, client_model.id, tg.id


def test_create_tour_calculates_snapshot(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "quantity": 5}],
    }
    response = client.post("/tours", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["totals"]["qty"] == 5
    assert Decimal(data["items"][0]["unitPriceExVat"]) == Decimal("3.00")
    assert Decimal(data["items"][0]["amountExVat"]) == Decimal("15.00")


def test_report_declarations(client):
    with TestingSessionLocal() as db:
        tenant_id, chauffeur_id, client_id, tg_id = _seed(db)
    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "CHAUFFEUR",
        "X-Dev-Sub": "dev|driver1",
    }
    payload = {
        "date": date.today().isoformat(),
        "clientId": client_id,
        "items": [{"tariffGroupId": tg_id, "quantity": 2}],
    }
    client.post("/tours", json=payload, headers=headers)

    headers_admin = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    resp = client.get("/reports/declarations", headers=headers_admin)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["quantity"] == 2
