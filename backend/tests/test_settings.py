import importlib

import pytest

from app.core import config as config_module
from app.core.config import Settings


@pytest.mark.parametrize(
    "value, expected",
    [
        ("http://localhost:3000,http://localhost:8000", ["http://localhost:3000", "http://localhost:8000"]),
        ("http://localhost:3000 http://localhost:8000", ["http://localhost:3000", "http://localhost:8000"]),
        ("[\"http://localhost:3000\", \"http://localhost:8000\"]", ["http://localhost:3000", "http://localhost:8000"]),
    ],
)

def test_settings_parses_cors_allow_origins(monkeypatch, value, expected):
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", value)
    settings = Settings()
    assert settings.cors_allow_origins == expected


def test_reload_settings_uses_default_when_env_not_set(monkeypatch):
    monkeypatch.delenv("CORS_ALLOW_ORIGINS", raising=False)
    importlib.reload(config_module)
    assert "http://localhost:3000" in config_module.settings.cors_allow_origins
