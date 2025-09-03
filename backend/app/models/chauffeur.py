from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Chauffeur(Base):
    tenant_id = Column(Integer, ForeignKey('tenant.id'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('user.id'), nullable=True)
    display_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    tenant = relationship('Tenant', backref='chauffeurs')
    user = relationship('User', backref='chauffeur', uselist=False)
