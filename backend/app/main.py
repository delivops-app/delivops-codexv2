from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.chauffeurs import router as chauffeurs_router
from app.api.tarifs import router as tarifs_router
from app.api.tournees import router as tournees_router
from app.api.saisies import router as saisies_router
from app.api.tours import router as tours_router
from app.api.reports import router as reports_router
from app.api.clients import router as clients_router
from app.api.monitoring import router as monitoring_router
from app.api.shopify import router as shopify_router
from app.api.billing import router as billing_router, webhook_router as stripe_webhook_router
from app.api.deps import get_tenant_id, auth_dependency
from app.core.config import settings
from app.middleware.audit import AuditMiddleware
from app.db.migrations import run_migrations
from app.core.logging import setup_logging

setup_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Run startup tasks before the application begins serving traffic."""

    run_migrations()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

for router in (
    admin_router,
    chauffeurs_router,
    tarifs_router,
    tournees_router,
    saisies_router,
    tours_router,
    reports_router,
    clients_router,
    monitoring_router,
    shopify_router,
    billing_router,
    stripe_webhook_router,
):
    app.include_router(router)


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
