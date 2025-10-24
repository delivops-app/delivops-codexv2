"""Seed the database with a demo tenant, users and chauffeurs.

Run this script from within the Docker ``api`` service so that it shares the
same dependencies and configuration as the backend container.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path
from typing import Iterable

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy.orm import Session

DEMO_USERS: tuple[dict[str, str], ...] = (
    {"auth0_sub": "auth0|0", "email": "user0@example.com", "role": "ADMIN"},
    {"auth0_sub": "auth0|1", "email": "user1@example.com", "role": "ADMIN"},
)


def ensure_demo_tenant(db: Session) -> Tenant:
    """Create the demo tenant if it does not exist yet."""

    tenant = db.query(Tenant).filter(Tenant.slug == "demo").first()
    if tenant:
        return tenant

    tenant = Tenant(name="Demo", slug="demo")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


def ensure_demo_users(db: Session, tenant: Tenant) -> list[User]:
    """Return demo users, creating them if needed."""

    users: list[User] = []
    created = False
    for data in DEMO_USERS:
        user = (
            db.query(User)
            .filter(User.tenant_id == tenant.id, User.email == data["email"])
            .first()
        )
        if user is None:
            user = User(
                tenant_id=tenant.id,
                auth0_sub=data["auth0_sub"],
                email=data["email"],
                role=data["role"],
            )
            db.add(user)
            created = True
        users.append(user)

    if created:
        db.commit()
        for user in users:
            db.refresh(user)

    return users


def ensure_chauffeur(
    db: Session,
    tenant: Tenant,
    user: User,
    index: int,
) -> Chauffeur:
    """Create a chauffeur for the given user if it does not already exist."""

    email = f"driver{user.id}_{index}@example.com"
    chauffeur = (
        db.query(Chauffeur)
        .filter(Chauffeur.tenant_id == tenant.id, Chauffeur.email == email)
        .first()
    )
    if chauffeur:
        return chauffeur

    chauffeur = Chauffeur(
        tenant_id=tenant.id,
        email=email,
        display_name=f"Driver {user.id}-{index}",
    )
    db.add(chauffeur)
    db.flush()

    record_creation_audit(db, tenant.id, user.id, chauffeur)

    db.commit()
    db.refresh(chauffeur)
    return chauffeur


def record_creation_audit(
    db: Session,
    tenant_id: int,
    user_id: int,
    chauffeur: Chauffeur,
) -> None:
    """Persist an AuditLog describing the chauffeur creation."""

    audit = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        entity="chauffeur",
        entity_id=chauffeur.id,
        action="create",
        after_json=json.dumps(
            {
                "email": chauffeur.email,
                "display_name": chauffeur.display_name,
            }
        ),
    )
    db.add(audit)


def seed_chauffeurs(db: Session, tenant: Tenant, users: Iterable[User]) -> None:
    """Ensure each user has one to three chauffeurs."""

    for user in users:
        for index in range(random.randint(1, 3)):
            ensure_chauffeur(db, tenant, user, index)


def run() -> None:
    db = SessionLocal()
    try:
        tenant = ensure_demo_tenant(db)
        users = ensure_demo_users(db, tenant)
        seed_chauffeurs(db, tenant, users)
    finally:
        db.close()


if __name__ == "__main__":
    run()
