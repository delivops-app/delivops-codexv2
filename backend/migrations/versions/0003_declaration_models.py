"""add declaration related tables"""

from alembic import op
import sqlalchemy as sa


revision = "0003_declaration_models"
down_revision = "0002_chauffeur_email_limit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tariffgroup",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("display_name", sa.String(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, default=0),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tariffgroup_tenant_id", "tariffgroup", ["tenant_id"], unique=False
    )
    op.create_index(
        "ix_tariffgroup_client_id", "tariffgroup", ["client_id"], unique=False
    )

    op.create_table(
        "tariff",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("tariff_group_id", sa.Integer(), nullable=False),
        sa.Column("price_ex_vat", sa.Numeric(10, 2), nullable=True),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["tariff_group_id"], ["tariffgroup.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tariff_tenant_id", "tariff", ["tenant_id"], unique=False)
    op.create_index(
        "ix_tariff_tariff_group_id", "tariff", ["tariff_group_id"], unique=False
    )

    op.create_table(
        "tour",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("driver_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["client.id"]),
        sa.ForeignKeyConstraint(["driver_id"], ["chauffeur.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tour_tenant_id", "tour", ["tenant_id"], unique=False)
    op.create_index("ix_tour_driver_id", "tour", ["driver_id"], unique=False)
    op.create_index("ix_tour_client_id", "tour", ["client_id"], unique=False)
    op.create_index("ix_tour_date", "tour", ["date"], unique=False)

    op.create_table(
        "touritem",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("tour_id", sa.Integer(), nullable=False),
        sa.Column("tariff_group_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_ex_vat_snapshot", sa.Numeric(10, 2), nullable=True),
        sa.Column("amount_ex_vat_snapshot", sa.Numeric(10, 2), nullable=True),
        sa.ForeignKeyConstraint(["tariff_group_id"], ["tariffgroup.id"]),
        sa.ForeignKeyConstraint(["tour_id"], ["tour.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenant.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_touritem_tenant_id", "touritem", ["tenant_id"], unique=False)
    op.create_index("ix_touritem_tour_id", "touritem", ["tour_id"], unique=False)
    op.create_index(
        "ix_touritem_tariff_group_id", "touritem", ["tariff_group_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_touritem_tariff_group_id", table_name="touritem")
    op.drop_index("ix_touritem_tour_id", table_name="touritem")
    op.drop_index("ix_touritem_tenant_id", table_name="touritem")
    op.drop_table("touritem")

    op.drop_index("ix_tour_date", table_name="tour")
    op.drop_index("ix_tour_client_id", table_name="tour")
    op.drop_index("ix_tour_driver_id", table_name="tour")
    op.drop_index("ix_tour_tenant_id", table_name="tour")
    op.drop_table("tour")

    op.drop_index("ix_tariff_tariff_group_id", table_name="tariff")
    op.drop_index("ix_tariff_tenant_id", table_name="tariff")
    op.drop_table("tariff")

    op.drop_index("ix_tariffgroup_client_id", table_name="tariffgroup")
    op.drop_index("ix_tariffgroup_tenant_id", table_name="tariffgroup")
    op.drop_table("tariffgroup")

