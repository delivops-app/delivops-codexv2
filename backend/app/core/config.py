import re
from urllib.parse import quote_plus

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_LOCALHOST_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "SQLALCHEMY_DATABASE_URL"),
    )
    database_scheme: str = Field(
        default="postgresql+psycopg", validation_alias="DATABASE_SCHEME"
    )
    database_host: str = Field(
        default="db", validation_alias=AliasChoices("DATABASE_HOST", "POSTGRES_HOST")
    )
    database_port: int = Field(
        default=5432, validation_alias=AliasChoices("DATABASE_PORT", "POSTGRES_PORT")
    )
    database_user: str = Field(
        default="delivops",
        validation_alias=AliasChoices("DATABASE_USER", "POSTGRES_USER"),
    )
    database_password: str = Field(
        default="changeme",
        validation_alias=AliasChoices("DATABASE_PASSWORD", "POSTGRES_PASSWORD"),
    )
    database_name: str = Field(
        default="delivops",
        validation_alias=AliasChoices("DATABASE_NAME", "POSTGRES_DB"),
    )
    auth0_domain: str = "dev-or3c4n80x1rba26g.eu.auth0.com"
    auth0_audience: str = "https://delivops-codex.api/"
    auth0_issuer: str = "https://dev-or3c4n80x1rba26g.eu.auth0.com/"
    auth0_algorithms: str = "RS256"
    tenant_header_name: str = "X-Tenant-Id"
    dev_fake_auth: bool = False
    loki_url: str | None = None
    cors_allow_origins: list[str] | str = Field(
        default_factory=lambda: list(DEFAULT_LOCALHOST_ORIGINS)
    )
    cors_allow_origin_regex: str | None = r"https?://(localhost|127\.0\.0\.1)(:\d+)?$"

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        """Allow comma or whitespace separated strings for list configuration."""
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            parts = re.split(r"[,\\s]+", value)
            return [origin for origin in (part.strip() for part in parts) if origin]
        return value

    @field_validator("cors_allow_origins", mode="after")
    @classmethod
    def _ensure_list(cls, value):
        if isinstance(value, str):
            return [value]
        return list(value)

    @model_validator(mode="after")
    def _assemble_database_url(self):
        if self.database_url:
            return self
        object.__setattr__(self, "database_url", self._build_database_url())
        return self

    def _build_database_url(self) -> str:
        user = quote_plus(self.database_user)
        password = quote_plus(self.database_password)
        return (
            f"{self.database_scheme}://{user}:{password}@"
            f"{self.database_host}:{self.database_port}/{self.database_name}"
        )


settings = Settings()
