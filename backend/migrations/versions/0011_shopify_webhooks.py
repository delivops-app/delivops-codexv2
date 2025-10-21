"""add shopify subscription id and integration events table

Revision ID: 0011_shopify_webhooks
Revises: 0010_tenant_subscriptions
Create Date: 2024-02-20 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0011_shopify_webhooks"
down_revision = "0010_tenant_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tenant_subscriptions",
        sa.Column("shopify_subscription_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_tenant_subscriptions_shopify_subscription_id",
        "tenant_subscriptions",
        ["shopify_subscription_id"],
    )
    op.create_unique_constraint(
        "uq_tenant_subscriptions_shopify_subscription_id",
        "tenant_subscriptions",
        ["shopify_subscription_id"],
    )

    op.create_table(
        "integration_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("event_id", sa.String(), nullable=False),
        sa.Column("topic", sa.String(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"], ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider", "event_id", name="uq_integration_events_provider_event"
        ),
    )


def downgrade() -> None:
    op.drop_table("integration_events")
    op.drop_constraint(
        "uq_tenant_subscriptions_shopify_subscription_id",
        "tenant_subscriptions",
        type_="unique",
    )
    op.drop_index(
        "ix_tenant_subscriptions_shopify_subscription_id",
        table_name="tenant_subscriptions",
    )
    op.drop_column("tenant_subscriptions", "shopify_subscription_id")
