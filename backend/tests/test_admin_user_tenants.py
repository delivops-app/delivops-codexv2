from fastapi.testclient import TestClient
from sqlalchemy import create_engine
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import auth_dependency
from app.core.config import settings
from app.db.session import get_db

from app.main import app
from app.models.base import Base
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
Base.metadata.create_all(bind=engine)
settings.dev_fake_auth = True


@pytest.fixture()
def client():
    previous_override = app.dependency_overrides.get(get_db)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is not None:
            app.dependency_overrides[get_db] = previous_override
        else:
            app.dependency_overrides.pop(get_db, None)



def reset_database() -> None:
    with engine.begin() as connection:
        connection.exec_driver_sql("PRAGMA foreign_keys = OFF")
        for table in Base.metadata.tables.values():
            connection.execute(table.delete())
        connection.exec_driver_sql("PRAGMA foreign_keys = ON")


def create_tenant(db, name: str, slug: str) -> Tenant:
    tenant = Tenant(name=name, slug=slug)
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def create_user(db, tenant_id: int, email: str, role: str, is_active: bool = True) -> User:
    user = User(
        tenant_id=tenant_id,
        auth0_sub=f"auth0|{email}",
        email=email,
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_user_tenant_links_visible_for_global_supervision(client):
    reset_database()

    with TestingSessionLocal() as db:
        tenant_alpha = create_tenant(db, "Alpha", "alpha")
        tenant_beta = create_tenant(db, "Beta", "beta")

        user_one = create_user(db, tenant_alpha.id, "admin.one@example.com", "ADMIN")
        user_two = create_user(
            db, tenant_beta.id, "admin.two@example.com", "ADMIN", is_active=False
        )

        tenant_alpha_id = tenant_alpha.id
        tenant_beta_id = tenant_beta.id
        user_one_id = user_one.id
        user_two_id = user_two.id

    assert tenant_alpha_id is not None and tenant_beta_id is not None
    assert user_one_id is not None and user_two_id is not None

    headers = {"X-Dev-Role": "GLOBAL_SUPERVISION"}
    response = client.get("/admin/user-tenants", headers=headers)

    assert response.status_code == 200
    payload = response.json()

    assert payload == [
        {
            "userId": user_one_id,
            "email": "admin.one@example.com",
            "role": "ADMIN",
            "isActive": True,
            "tenantId": tenant_alpha_id,
            "tenantName": "Alpha",
            "tenantSlug": "alpha",
        },
        {
            "userId": user_two_id,
            "email": "admin.two@example.com",
            "role": "ADMIN",
            "isActive": False,
            "tenantId": tenant_beta_id,
            "tenantName": "Beta",
            "tenantSlug": "beta",
        },
    ]


def test_user_tenant_links_forbidden_for_non_supervision(client):
    reset_database()

    response = client.get("/admin/user-tenants", headers={"X-Dev-Role": "ADMIN"})

    assert response.status_code == 403


def test_user_tenant_links_visible_with_namespaced_roles_claim(client):
    reset_database()

    with TestingSessionLocal() as db:
        tenant_alpha = create_tenant(db, "Alpha", "alpha")
        tenant_beta = create_tenant(db, "Beta", "beta")

        user_one = create_user(db, tenant_alpha.id, "admin.one@example.com", "ADMIN")
        user_two = create_user(
            db, tenant_beta.id, "admin.two@example.com", "ADMIN", is_active=False
        )

        tenant_alpha_id = tenant_alpha.id
        tenant_beta_id = tenant_beta.id
        user_one_id = user_one.id
        user_two_id = user_two.id

    assert tenant_alpha_id is not None and tenant_beta_id is not None
    assert user_one_id is not None and user_two_id is not None

    override_user = {
        "https://delivops/roles": ["Delivops Team"],
    }

    previous_override = app.dependency_overrides.get(auth_dependency)
    app.dependency_overrides[auth_dependency] = lambda: override_user
    try:
        response = client.get("/admin/user-tenants")
    finally:
        if previous_override is not None:
            app.dependency_overrides[auth_dependency] = previous_override
        else:
            app.dependency_overrides.pop(auth_dependency, None)

    assert response.status_code == 200
    payload = response.json()

    assert payload == [
        {
            "userId": user_one_id,
            "email": "admin.one@example.com",
            "role": "ADMIN",
            "isActive": True,
            "tenantId": tenant_alpha_id,
            "tenantName": "Alpha",
            "tenantSlug": "alpha",
        },
        {
            "userId": user_two_id,
            "email": "admin.two@example.com",
            "role": "ADMIN",
            "isActive": False,
            "tenantId": tenant_beta_id,
            "tenantName": "Beta",
            "tenantSlug": "beta",
        },
    ]
