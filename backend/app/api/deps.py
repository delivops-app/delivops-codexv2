from fastapi import Header, HTTPException

from app.core.config import settings


def get_tenant_id(x_tenant_id: str = Header(..., alias=settings.tenant_header_name)):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="Missing tenant header")
    return x_tenant_id
