from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, dev_fake_auth
from app.core.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User


ROLE_ALIASES = {
    "Admin Codex": "ADMIN",
    "Chauffeur Codex": "CHAUFFEUR",
    "Supervision Globale": "GLOBAL_SUPERVISION",
    "Delivops Team": "GLOBAL_SUPERVISION",
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


def require_tenant_roles(*required_roles: str):
    """Ensure the current user has the roles and belongs to the requested tenant."""

    def _tenant_role_dependency(  # noqa: B008
        user: dict = Depends(auth_dependency),
        tenant_id: int = Depends(get_tenant_id),
        db: Session = Depends(get_db),
    ):
        roles = {ROLE_ALIASES.get(r, r) for r in user.get("roles", [])}
        if "GLOBAL_SUPERVISION" in roles:
            # Global supervision users must be able to impersonate tenant admins
            # without belonging to each tenant explicitly.
            roles.add("ADMIN")
        if not any(role in roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )

        if "GLOBAL_SUPERVISION" in roles:
            return user

        tenant_exists = db.execute(
            select(Tenant.id).where(Tenant.id == tenant_id)
        ).scalar_one_or_none()
        if tenant_exists is None:
            raise HTTPException(status_code=404, detail="Tenant not found")

        sub = user.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not associated with tenant",
            )

        membership = db.execute(
            select(User.id).where(
                User.auth0_sub == sub,
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
            )
        ).scalar_one_or_none()

        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not associated with tenant",
            )

        return user

    return _tenant_role_dependency
