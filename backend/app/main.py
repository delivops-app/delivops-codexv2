from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.auth import get_current_user, dev_fake_auth
from app.api.chauffeurs import router as chauffeurs_router
from app.api.deps import get_tenant_id

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(chauffeurs_router)


def auth_dependency(
    authorization: str = Header(None),
    x_dev_role: str = Header(None, alias="X-Dev-Role"),
    x_dev_sub: str = Header(None, alias="X-Dev-Sub"),
):
    if settings.dev_fake_auth:
        return dev_fake_auth(x_dev_role, x_dev_sub)
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid scheme")
    return get_current_user(token)


@app.get("/auth/me")
def read_me(user: dict = Depends(auth_dependency), tenant_id: str = Depends(get_tenant_id)):
    return {"tenant_id": tenant_id, "token_claims": user}


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
