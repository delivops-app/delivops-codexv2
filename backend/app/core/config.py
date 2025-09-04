from pydantic_settings import BaseSettings



class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://delivops:delivops_pw@db:5432/delivops"
    auth0_domain: str = "dev-or3c4n80x1rba26g.eu.auth0.com"
    auth0_audience: str = "https://delivops-codex.api/"
    auth0_issuer: str = "https://dev-or3c4n80x1rba26g.eu.auth0.com/"
    auth0_algorithms: str = "RS256"
    tenant_header_name: str = "X-Tenant-Id"
    dev_fake_auth: bool = False


settings = Settings()
