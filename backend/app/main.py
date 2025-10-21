from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chauffeurs import router as chauffeurs_router
from app.api.tarifs import router as tarifs_router
from app.api.tournees import router as tournees_router
from app.api.saisies import router as saisies_router
from app.api.tours import router as tours_router
from app.api.reports import router as reports_router
from app.api.clients import router as clients_router
from app.api.monitoring import router as monitoring_router
from app.api.shopify import router as shopify_router
from app.api.deps import get_tenant_id, auth_dependency
from app.core.config import settings
from app.middleware.audit import AuditMiddleware
from app.db.migrations import run_migrations
from app.core.logging import setup_logging

setup_logging()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)


@app.on_event("startup")
def apply_migrations() -> None:
    """Ensure the database schema is up to date before handling requests."""

    run_migrations()

app.include_router(chauffeurs_router)
app.include_router(tarifs_router)
app.include_router(tournees_router)
app.include_router(saisies_router)
app.include_router(tours_router)
app.include_router(reports_router)
app.include_router(clients_router)
app.include_router(monitoring_router)
app.include_router(shopify_router)


@app.get("/auth/me")
def read_me(
    user: dict = Depends(auth_dependency),  # noqa: B008
    tenant_id: str = Depends(get_tenant_id),  # noqa: B008
):
    return {"tenant_id": tenant_id, "token_claims": user}


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
