"""Introduce Stripe billing tables and fields."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0012_stripe_billing"
down_revision = "0011_shopify_webhooks"
branch_labels = None
depends_on = None


PLAN_ENUM = sa.Enum(
    "START",
    "PRO",
    "BUSINESS",
    "ENTERPRISE",
    "EARLY_PARTNER",
    name="plantier",
)

SUB_STATUS_ENUM = sa.Enum(
    "TRIALING",
    "ACTIVE",
    "PAST_DUE",
    "CANCELED",
    "PAUSED",
    name="subscriptionstatus",
)


def upgrade() -> None:
    bind = op.get_bind()
    PLAN_ENUM.create(bind, checkfirst=True)
    SUB_STATUS_ENUM.create(bind, checkfirst=True)

    op.add_column(
        "tenant",
        sa.Column("plan", PLAN_ENUM, nullable=False, server_default="START"),
    )
    op.add_column(
        "tenant",
        sa.Column(
            "subscription_status",
            SUB_STATUS_ENUM,
            nullable=False,
            server_default="TRIALING",
        ),
    )
    op.add_column(
        "tenant",
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
    )
    op.add_column(
        "tenant",
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
    )
    op.add_column(
        "tenant",
        sa.Column("trial_ends_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "tenant",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "tenant",
        sa.Column(
            "subscription_status_since",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_unique_constraint(
        "uq_tenant_stripe_customer_id",
        "tenant",
        ["stripe_customer_id"],
    )
    op.create_unique_constraint(
        "uq_tenant_stripe_subscription_id",
        "tenant",
        ["stripe_subscription_id"],
    )

    op.create_table(
        "entitlements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenant.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("bool_value", sa.Boolean(), nullable=True),
        sa.Column("int_value", sa.Integer(), nullable=True),
        sa.Column("str_value", sa.String(), nullable=True),
        sa.UniqueConstraint("tenant_id", "key", name="uq_entitlements_tenant_key"),
    )
    op.create_index(
        "ix_entitlements_tenant_id",
        "entitlements",
        ["tenant_id"],
    )

    op.alter_column("tenant", "plan", server_default=None)
    op.alter_column("tenant", "subscription_status", server_default=None)
    op.alter_column("tenant", "updated_at", server_default=None)
    op.alter_column("tenant", "subscription_status_since", server_default=None)


def downgrade() -> None:
    op.alter_column("tenant", "subscription_status_since", server_default=sa.func.now())
    op.alter_column("tenant", "updated_at", server_default=sa.func.now())

    op.drop_index("ix_entitlements_tenant_id", table_name="entitlements")
    op.drop_table("entitlements")

    op.drop_constraint("uq_tenant_stripe_subscription_id", "tenant", type_="unique")
    op.drop_constraint("uq_tenant_stripe_customer_id", "tenant", type_="unique")

    op.drop_column("tenant", "subscription_status_since")
    op.drop_column("tenant", "updated_at")
    op.drop_column("tenant", "trial_ends_at")
    op.drop_column("tenant", "stripe_subscription_id")
    op.drop_column("tenant", "stripe_customer_id")
    op.drop_column("tenant", "subscription_status")
    op.drop_column("tenant", "plan")

    SUB_STATUS_ENUM.drop(op.get_bind(), checkfirst=False)
    PLAN_ENUM.drop(op.get_bind(), checkfirst=False)
