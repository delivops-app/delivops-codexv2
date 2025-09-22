from alembic import op
import sqlalchemy as sa


revision = "0004_tour_kind"
down_revision = "0003_declaration_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tour",
        sa.Column("kind", sa.String(), nullable=False, server_default="DELIVERY"),
    )

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.create_check_constraint(
            "ck_tour_kind",
            "tour",
            "kind IN ('PICKUP', 'DELIVERY')",
        )

    op.execute("UPDATE tour SET kind = 'DELIVERY' WHERE kind IS NULL")
    if bind.dialect.name != "sqlite":
        op.alter_column("tour", "kind", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("ck_tour_kind", "tour", type_="check")

    op.drop_column("tour", "kind")
