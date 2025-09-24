from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, dev_fake_auth
from app.core.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant


ROLE_ALIASES = {
    "Admin Codex": "ADMIN",
    "Chauffeur Codex": "CHAUFFEUR",
}


def get_tenant_id(
    x_tenant_id: str = Header(..., alias=settings.tenant_header_name),
    db: Session = Depends(get_db),  # noqa: B008
) -> int:
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Missing tenant header")

    tenant_identifier = x_tenant_id.strip()
    if not tenant_identifier:
        raise HTTPException(status_code=400, detail="Missing tenant header")

    slug = tenant_identifier.lower()
    tenant_id = db.execute(
        select(Tenant.id).where(func.lower(Tenant.slug) == slug)
    ).scalar_one_or_none()
    if tenant_id is not None:
        return tenant_id

    try:
        return int(tenant_identifier)
    except ValueError as exc:  # pragma: no cover - defensive safeguard
        raise HTTPException(status_code=404, detail="Tenant not found") from exc


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
