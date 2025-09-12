from datetime import date

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

    headers = {"X-Tenant-Id": str(tenant_id), "X-Dev-Role": "ADMIN"}
    response = client.get("/tournees/synthese", headers=headers)
    assert response.status_code == 200
    assert "Synthèse des tournées" in response.text
