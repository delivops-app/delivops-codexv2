from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


DEFAULT_LOCALHOST_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://delivops:changeme@db:5432/delivops"
    auth0_domain: str = "dev-or3c4n80x1rba26g.eu.auth0.com"
    auth0_audience: str = "https://delivops-codex.api/"
    auth0_issuer: str = "https://dev-or3c4n80x1rba26g.eu.auth0.com/"
    auth0_algorithms: str = "RS256"
    tenant_header_name: str = "X-Tenant-Id"
    dev_fake_auth: bool = False
    loki_url: str | None = None
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: list(DEFAULT_LOCALHOST_ORIGINS)
    )
    cors_allow_origin_regex: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Allow comma separated strings for list configuration."""
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
