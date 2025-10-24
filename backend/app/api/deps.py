import re
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user, dev_fake_auth
from app.core.config import settings
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.services import billing


ROLE_ALIASES = {
    "Admin Codex": "ADMIN",
    "Chauffeur Codex": "CHAUFFEUR",
    "Supervision Globale": "GLOBAL_SUPERVISION",
    "Delivops Team": "GLOBAL_SUPERVISION",
}


def _iter_role_values(value) -> set[str]:
    """Yield individual role strings from heterogeneous claim payloads."""

    collected: set[str] = set()

    def _collect(item) -> None:
        if isinstance(item, str):
            normalized = item.strip()
            if normalized:
                collected.add(normalized)
        elif isinstance(item, (list, tuple, set)):
            for element in item:
                _collect(element)

    _collect(value)
    return collected


def _extract_roles(user: dict) -> set[str]:
    """Return normalized roles for the authenticated user.

    Auth0 exposes custom claims under a namespace (e.g. ``https://delivops/roles``).
    In development we also rely on the plain ``roles`` attribute through ``DEV_FAKE_AUTH``.
    To make sure permissions are enforced consistently we merge every supported claim
    into a single normalized set while applying the configured aliases.
    """

    if not isinstance(user, dict):
        return set()

    discovered: set[str] = set()
    for key, value in user.items():
        if not isinstance(key, str):
            continue
        key_lower = key.lower()
        if key == "roles" or key_lower.endswith("/roles"):
            discovered.update(_iter_role_values(value))

    normalized = {ROLE_ALIASES.get(role, role) for role in discovered}
    return normalized


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
        roles = _extract_roles(user)
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
        roles = _extract_roles(user)
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
            auto_provisioned = _auto_provision_membership(
                db=db,
                tenant_id=tenant_id,
                sub=sub,
                roles=roles,
                user=user,
            )
            if not auto_provisioned:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User not associated with tenant",
                )

        return user

    return _tenant_role_dependency


def has_entitlement(
    db: Session,
    tenant_id: int,
    key: str,
) -> bool:
    tenant = (
        db.query(Tenant)
        .options(selectinload(Tenant.entitlements))
        .filter(Tenant.id == tenant_id)
        .one_or_none()
    )
    if tenant is None:
        return False
    return billing.has_entitlement(tenant, key)


def require_entitlement(key: str, allow_read_only: bool = False):
    def _dependency(
        tenant_id: int = Depends(get_tenant_id),
        db: Session = Depends(get_db),
    ) -> bool:
        tenant = (
            db.query(Tenant)
            .options(selectinload(Tenant.entitlements))
            .filter(Tenant.id == tenant_id)
            .one_or_none()
        )
        if tenant is None:
            raise HTTPException(status_code=404, detail="Tenant not found")

        gate = billing.compute_billing_gate_status(tenant)
        access = gate.get("access")
        if access == "suspended" or (access == "read_only" and not allow_read_only):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Subscription inactive",
            )

        if not billing.has_entitlement(tenant, key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing entitlement",
            )
        return True

    return _dependency
AUTO_PROVISION_EMAIL_DOMAIN = "autoprovision.delivops"


def _extract_user_email(user: dict, sub: str) -> str:
    """Return an email for the user, generating a placeholder if missing."""

    email = user.get("email")
    if isinstance(email, str) and email.strip():
        return email.strip().lower()

    sanitized = re.sub(r"[^a-z0-9._+-]", ".", sub.lower())
    sanitized = re.sub(r"\.\.+", ".", sanitized).strip(".")
    if not sanitized:
        sanitized = "auto"
    return f"{sanitized}@{AUTO_PROVISION_EMAIL_DOMAIN}"


def _auto_provision_membership(
    db: Session, tenant_id: int, sub: str, roles: set[str], user: dict
) -> bool:
    """Create an admin membership on-the-fly when missing.

    The best experience for Delivops operators is to avoid manual backoffice steps
    when a freshly invited admin connects for the first time. We only auto-provision
    administrators because they are the actors allowed to manage tenant data.
    """

    if "ADMIN" not in roles:
        return False

    email = _extract_user_email(user, sub)
    new_user = User(
        tenant_id=tenant_id,
        auth0_sub=sub,
        email=email,
        role="ADMIN",
        is_active=True,
    )
    db.add(new_user)
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(User.id).where(
                User.auth0_sub == sub,
                User.tenant_id == tenant_id,
                User.is_active.is_(True),
            )
        ).scalar_one_or_none()
        return existing is not None

