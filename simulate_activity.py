from app.db.session import SessionLocal
from app.models.tenant import Tenant
from app.models.user import User
from app.models.chauffeur import Chauffeur
from app.models.audit import AuditLog
import json
import random


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
