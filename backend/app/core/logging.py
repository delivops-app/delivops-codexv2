import logging

try:
    from logging_loki import LokiHandler
except Exception:  # pragma: no cover - optional dependency
    LokiHandler = None

from app.core.config import settings


def setup_logging() -> None:
    """Configure logging to export Audit logs to Loki if configured."""
    if settings.loki_url and LokiHandler:
        handler = LokiHandler(
            url=settings.loki_url,
            version="1",
        )
        logger = logging.getLogger("audit")
        logger.setLevel(logging.INFO)
        logger.addHandler(handler)
