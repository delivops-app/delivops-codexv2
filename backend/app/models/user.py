from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class User(Base):
    tenant_id = Column(Integer, ForeignKey('tenant.id'), nullable=False, index=True)
    auth0_sub = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    role = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    tenant = relationship('Tenant', backref='users')
