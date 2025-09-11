from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class AuditLog(Base):
    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("user.id"))
    entity = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    before_json = Column(String)
    after_json = Column(String)

    tenant = relationship("Tenant")
    user = relationship("User")
