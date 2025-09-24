"""Add last_seen_at to chauffeur"""

from datetime import datetime

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0007_chauffeur_last_seen"
down_revision = "0006_tariff_margin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chauffeur", sa.Column("last_seen_at", sa.DateTime(), nullable=True))

    connection = op.get_bind()
    now = datetime.utcnow()
    connection.execute(sa.text("UPDATE chauffeur SET last_seen_at = :now"), {"now": now})


def downgrade() -> None:
    op.drop_column("chauffeur", "last_seen_at")
