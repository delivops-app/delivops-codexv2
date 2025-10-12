"""Utilities to run database migrations programmatically."""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy.engine import make_url

from app.core.config import settings

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Apply Alembic migrations up to the latest revision.

    This helper is used during application start-up so that local and
    containerised environments automatically converge to the expected schema
    without requiring a manual ``alembic upgrade head``.
    """

    base_dir = Path(__file__).resolve().parents[2]
    database_url = settings.database_url
    if make_url(database_url).drivername.startswith("sqlite"):
        logger.info("SQLite database detected; skipping Alembic migrations")
        return

    alembic_cfg = Config(str(base_dir / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(base_dir / "migrations"))
    alembic_cfg.set_main_option("sqlalchemy.url", database_url)

    logger.info("Running database migrations")
    command.upgrade(alembic_cfg, "head")
    logger.info("Database migrations applied")
