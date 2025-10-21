"""add tenant subscriptions table

Revision ID: 0010_tenant_subscriptions
Revises: 0009_fix_chauffeur_is_active
Create Date: 2024-02-10 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0010_tenant_subscriptions"
down_revision = "0009_fix_chauffeur_is_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tenant_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("shopify_plan_id", sa.String(), nullable=False),
        sa.Column("max_chauffeurs", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("period", sa.JSON(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column(
        "tenant",
        sa.Column("active_subscription_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "tenant_active_subscription_id_fkey",
        "tenant",
        "tenant_subscriptions",
        ["active_subscription_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "tenant_active_subscription_id_fkey", "tenant", type_="foreignkey"
    )
    op.drop_column("tenant", "active_subscription_id")
    op.drop_table("tenant_subscriptions")
