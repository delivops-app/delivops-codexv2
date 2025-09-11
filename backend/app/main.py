from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chauffeurs import router as chauffeurs_router
from app.api.deps import get_tenant_id, auth_dependency
from app.middleware.audit import AuditMiddleware
from app.core.logging import setup_logging

setup_logging()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

app.include_router(chauffeurs_router)


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
