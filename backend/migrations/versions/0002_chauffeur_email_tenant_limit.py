"""add chauffeur email and tenant max_chauffeurs

Revision ID: 0002_chauffeur_email_tenant_limit
Revises: 0001_initial
Create Date: 2024-05-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0002_chauffeur_email_tenant_limit"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenant", sa.Column("max_chauffeurs", sa.Integer(), nullable=True))
    op.add_column("chauffeur", sa.Column("email", sa.String(), nullable=False))
    op.create_unique_constraint("uq_chauffeur_email", "chauffeur", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_chauffeur_email", "chauffeur", type_="unique")
    op.drop_column("chauffeur", "email")
    op.drop_column("tenant", "max_chauffeurs")
