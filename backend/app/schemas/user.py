from pydantic import BaseModel


class UserTenantLink(BaseModel):
    userId: int
    email: str
    role: str
    isActive: bool
    tenantId: int
    tenantName: str
    tenantSlug: str
