"""Ensure chauffeur is_active is non-null with default"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0009_fix_chauffeur_is_active"
down_revision = "0008_create_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("UPDATE chauffeur SET is_active = true WHERE is_active IS NULL")
    )
    op.alter_column(
        "chauffeur",
        "is_active",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.true(),
    )


def downgrade() -> None:
    op.alter_column(
        "chauffeur",
        "is_active",
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=None,
    )
