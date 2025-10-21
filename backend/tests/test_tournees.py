from datetime import date
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
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tournee import Tournee
from app.models.saisie import Saisie
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


def test_synthese_handles_null_nb_livres(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme4")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        chauffeur = Chauffeur(
            tenant_id=tenant.id, email="driver@example.com", display_name="Driver"
        )
        client_model = Client(tenant_id=tenant.id, name="Client A")
        db.add_all([chauffeur, client_model])
        db.commit()
        db.refresh(chauffeur)
        db.refresh(client_model)

        tournee = Tournee(
            tenant_id=tenant.id,
            chauffeur_id=chauffeur.id,
            client_id=client_model.id,
            date=date(2023, 1, 1),
            numero_ordre=1,
        )
        db.add(tournee)
        db.commit()
        db.refresh(tournee)

        saisie = Saisie(
            tenant_id=tenant.id,
            tournee_id=tournee.id,
            type="foo",
            groupe_colis="A",
            nb_recup=0,
            nb_livres=None,
        )
        db.add(saisie)
        db.commit()

        tenant_id = tenant.id

    with TestingSessionLocal() as db:
        admin_sub = _create_admin_user(db, tenant_id)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    response = client.get("/tournees/synthese", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["data"][0]["groups"]["A"] == 0
    assert data["data"][0]["total"] == 0


def test_synthese_sums_saisies_same_group(client):
    with TestingSessionLocal() as db:
        tenant = Tenant(name="Acme", slug="acme5")
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        chauffeur = Chauffeur(
            tenant_id=tenant.id, email="driver2@example.com", display_name="Driver"
        )
        client_model = Client(tenant_id=tenant.id, name="Client A")
        db.add_all([chauffeur, client_model])
        db.commit()
        db.refresh(chauffeur)
        db.refresh(client_model)

        tournee = Tournee(
            tenant_id=tenant.id,
            chauffeur_id=chauffeur.id,
            client_id=client_model.id,
            date=date(2023, 1, 2),
            numero_ordre=1,
        )
        db.add(tournee)
        db.commit()
        db.refresh(tournee)

        s1 = Saisie(
            tenant_id=tenant.id,
            tournee_id=tournee.id,
            type="foo",
            groupe_colis="A",
            nb_recup=0,
            nb_livres=3,
        )
        s2 = Saisie(
            tenant_id=tenant.id,
            tournee_id=tournee.id,
            type="foo",
            groupe_colis="A",
            nb_recup=0,
            nb_livres=5,
        )
        db.add_all([s1, s2])
        db.commit()

        tenant_id = tenant.id

    with TestingSessionLocal() as db:
        admin_sub = _create_admin_user(db, tenant_id)

    headers = {
        "X-Tenant-Id": str(tenant_id),
        "X-Dev-Role": "ADMIN",
        "X-Dev-Sub": admin_sub,
    }
    response = client.get("/tournees/synthese", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["data"][0]["groups"]["A"] == 8
    assert data["data"][0]["total"] == 8
