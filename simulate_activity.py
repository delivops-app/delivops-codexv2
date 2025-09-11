"""Seed the database with a demo tenant, users and chauffeurs.

This script is meant to be executed from the repository root without any
additional environment configuration. It ensures the backend code is on the
``PYTHONPATH`` and that a reasonable default ``DATABASE_URL`` is provided when
none is defined.
"""

import json
import os
import random
import sys
from pathlib import Path

# Allow running the script without manually setting PYTHONPATH
ROOT = Path(__file__).resolve().parent
sys.path.append(str(ROOT / "backend"))

# Default to connecting to the local database if DATABASE_URL isn't set
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg://delivops:changeme@localhost:5432/delivops"
)

from app.db.session import SessionLocal
from app.models.audit import AuditLog
from app.models.chauffeur import Chauffeur
from app.models.tenant import Tenant
from app.models.user import User


def run() -> None:
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(name="Demo", slug="demo")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        users = []
        for i in range(2):
            user = User(
                tenant_id=tenant.id,
                auth0_sub=f"auth0|{i}",
                email=f"user{i}@example.com",
                role="ADMIN",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            users.append(user)

        for user in users:
            for j in range(random.randint(1, 3)):
                chauffeur = Chauffeur(
                    tenant_id=tenant.id,
                    email=f"driver{user.id}_{j}@example.com",
                    display_name=f"Driver {user.id}-{j}",
                )
                db.add(chauffeur)
                db.commit()
                db.refresh(chauffeur)

                audit = AuditLog(
                    tenant_id=tenant.id,
                    user_id=user.id,
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
                db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
