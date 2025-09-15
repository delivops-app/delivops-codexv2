from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import get_current_user, dev_fake_auth
from app.core.config import settings


ROLE_ALIASES = {
    "Admin Codex": "ADMIN",
    "Chauffeur Codex": "CHAUFFEUR",
}


def get_tenant_id(x_tenant_id: str = Header(..., alias=settings.tenant_header_name)):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Missing tenant header")
    return x_tenant_id


def auth_dependency(
    authorization: str = Header(None),
    x_dev_role: str = Header(None, alias="X-Dev-Role"),
    x_dev_sub: str = Header(None, alias="X-Dev-Sub"),
):
    if settings.dev_fake_auth:
        return dev_fake_auth(x_dev_role, x_dev_sub)
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization"
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid scheme"
        )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    return get_current_user(creds)


def require_roles(*required_roles: str):
    """Dependency ensuring current user has at least one of required roles."""

    def _role_dependency(user: dict = Depends(auth_dependency)):  # noqa: B008
        roles = [ROLE_ALIASES.get(r, r) for r in user.get("roles", [])]
        if not any(role in roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return user

    return _role_dependency
