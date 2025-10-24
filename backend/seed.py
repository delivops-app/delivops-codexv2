from datetime import date
from decimal import Decimal

from app.db.session import SessionLocal
from app.models.tenant import Tenant, TenantSubscription
from app.models.user import User
from app.models.chauffeur import Chauffeur
from app.models.client import Client
from app.models.tariff_group import TariffGroup
from app.models.tariff import Tariff
from app.services.billing import ensure_early_partner_seed


def run():
    db = SessionLocal()
    if db.query(Tenant).first():
        db.close()
        return

    tenant = Tenant(name="Demo", slug="demo")
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    subscription = TenantSubscription(
        tenant_id=tenant.id,
        shopify_plan_id="demo-plan",
        shopify_subscription_id="demo-subscription",
        max_chauffeurs=5,
        status="active",
        period={"start": "2020-01-01", "end": None},
        metadata={"seed": True},
    )
    tenant.max_chauffeurs = subscription.max_chauffeurs
    tenant.active_subscription = subscription
    db.add(subscription)
    db.commit()
    db.refresh(tenant)

    ensure_early_partner_seed(db, tenant)

    admin_user = User(
        tenant_id=tenant.id,
        auth0_sub="dev|admin",
        email="admin@example.com",
        role="ADMIN",
    )
    driver_user = User(
        tenant_id=tenant.id,
        auth0_sub="dev|driver",
        email="driver@example.com",
        role="CHAUFFEUR",
    )
    db.add_all([admin_user, driver_user])
    db.commit()
    db.refresh(driver_user)

    chauffeur = Chauffeur(
        tenant_id=tenant.id,
        user_id=driver_user.id,
        email="driver@example.com",
        display_name="Ali",
    )
    client = Client(tenant_id=tenant.id, name="Amazon")
    db.add_all([chauffeur, client])
    db.commit()
    db.refresh(client)

    tg_std = TariffGroup(
        tenant_id=tenant.id,
        client_id=client.id,
        code="tg_STD",
        display_name="Colis standards",
        unit="colis",
        order=1,
    )
    tg_box = TariffGroup(
        tenant_id=tenant.id,
        client_id=client.id,
        code="tg_BOX",
        display_name="Cartons",
        unit="colis",
        order=2,
    )
    db.add_all([tg_std, tg_box])
    db.commit()
    db.refresh(tg_std)
    db.refresh(tg_box)

    t1 = Tariff(
        tenant_id=tenant.id,
        tariff_group_id=tg_std.id,
        price_ex_vat=Decimal("3.00"),
        vat_rate=Decimal("0.20"),
        effective_from=date(2020, 1, 1),
    )
    t2 = Tariff(
        tenant_id=tenant.id,
        tariff_group_id=tg_box.id,
        price_ex_vat=Decimal("5.00"),
        vat_rate=Decimal("0.20"),
        effective_from=date(2020, 1, 1),
    )
    db.add_all([t1, t2])
    db.commit()
    db.close()


if __name__ == "__main__":
    run()
