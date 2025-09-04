from app.db.session import SessionLocal
from app.models.tenant import Tenant


def run():
    db = SessionLocal()
    if not db.query(Tenant).first():
        tenant = Tenant(name="Demo", slug="demo")
        db.add(tenant)
        db.commit()
    db.close()


if __name__ == "__main__":
    run()
