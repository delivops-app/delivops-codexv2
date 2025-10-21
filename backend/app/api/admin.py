from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import UserTenantLink

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/user-tenants", response_model=List[UserTenantLink])
def list_user_tenant_links(
    db: Session = Depends(get_db),  # noqa: B008
    _: dict = Depends(require_roles("GLOBAL_SUPERVISION")),  # noqa: B008
) -> List[UserTenantLink]:
    rows = (
        db.execute(
            select(
                User.id.label("user_id"),
                User.email,
                User.role,
                User.is_active,
                Tenant.id.label("tenant_id"),
                Tenant.name.label("tenant_name"),
                Tenant.slug.label("tenant_slug"),
            )
            .join(Tenant, Tenant.id == User.tenant_id)
            .order_by(Tenant.name.asc(), User.email.asc())
        )
        .all()
    )

    return [
        UserTenantLink(
            userId=row.user_id,
            email=row.email,
            role=row.role,
            isActive=row.is_active,
            tenantId=row.tenant_id,
            tenantName=row.tenant_name,
            tenantSlug=row.tenant_slug,
        )
        for row in rows
    ]
