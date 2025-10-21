from decimal import Decimal
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.session import get_db
from app.models.base import Base
from app.models.tenant import Tenant
from app.models.client import Client
from app.models.user import User
from app.models.tarif import Tarif
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

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
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


def test_create_tarif_rejects_client_from_other_tenant(client):
    with TestingSessionLocal() as db:
        tenant_main = Tenant(name="Tenant Main", slug="tenant-tarif-main")
        tenant_other = Tenant(name="Tenant Other", slug="tenant-tarif-other")
        db.add_all([tenant_main, tenant_other])
        db.commit()
        db.refresh(tenant_main)
        db.refresh(tenant_other)

        client_main = Client(name="Client Main", tenant_id=tenant_main.id)
        client_other = Client(name="Client Other", tenant_id=tenant_other.id)
        db.add_all([client_main, client_other])
        db.commit()
        db.refresh(client_main)
        db.refresh(client_other)

        tenant_main_id = tenant_main.id
        foreign_client_id = client_other.id

    with TestingSessionLocal() as db:
        admin_sub = _create_admin_user(db, tenant_main_id)

    headers = {
        "X-Tenant-Id": str(tenant_main_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    response = client.post(
        "/tarifs/",
        json={
            "client_id": foreign_client_id,
            "groupe_colis": "COLIS",
            "mode": "STANDARD",
            "montant_unitaire": "10.00",
            "prime_seuil_nb_colis": 0,
            "prime_montant": "0",
            "actif": True,
        },
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Client does not belong to tenant"


def test_update_tarif_rejects_switch_to_other_tenant_client(client):
    with TestingSessionLocal() as db:
        tenant_main = Tenant(name="Tenant Update", slug="tenant-tarif-update")
        tenant_other = Tenant(name="Tenant Update Other", slug="tenant-tarif-update-other")
        db.add_all([tenant_main, tenant_other])
        db.commit()
        db.refresh(tenant_main)
        db.refresh(tenant_other)

        client_main = Client(name="Client Update", tenant_id=tenant_main.id)
        client_other = Client(name="Client Update Other", tenant_id=tenant_other.id)
        db.add_all([client_main, client_other])
        db.commit()
        db.refresh(client_main)
        db.refresh(client_other)

        tarif = Tarif(
            tenant_id=tenant_main.id,
            client_id=client_main.id,
            groupe_colis="COLIS",
            mode="STANDARD",
            montant_unitaire=Decimal("5.00"),
            prime_seuil_nb_colis=0,
            prime_montant=Decimal("0"),
            actif=True,
        )
        db.add(tarif)
        db.commit()
        db.refresh(tarif)

        tenant_main_id = tenant_main.id
        tarif_id = tarif.id
        foreign_client_id = client_other.id

    with TestingSessionLocal() as db:
        admin_sub = _create_admin_user(db, tenant_main_id)

    headers = {
        "X-Tenant-Id": str(tenant_main_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    response = client.put(
        f"/tarifs/{tarif_id}",
        json={"client_id": foreign_client_id},
        headers=headers,
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Client does not belong to tenant"
