from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0006_tariff_margin"
down_revision = "0005_unify_tours"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tariff",
        sa.Column(
            "margin_ex_vat",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "touritem",
        sa.Column(
            "unit_margin_ex_vat_snapshot",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "touritem",
        sa.Column(
            "margin_ex_vat_snapshot",
            sa.Numeric(10, 2),
            nullable=False,
            server_default="0",
        ),
    )

    op.alter_column("tariff", "margin_ex_vat", server_default=None)
    op.alter_column(
        "touritem",
        "unit_margin_ex_vat_snapshot",
        server_default=None,
    )
    op.alter_column(
        "touritem",
        "margin_ex_vat_snapshot",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("touritem", "margin_ex_vat_snapshot")
    op.drop_column("touritem", "unit_margin_ex_vat_snapshot")
    op.drop_column("tariff", "margin_ex_vat")
