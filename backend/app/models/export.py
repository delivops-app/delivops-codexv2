from datetime import date
from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Export(Base):
    tenant_id = Column(Integer, ForeignKey('tenant.id'), nullable=False)
    type = Column(String, nullable=False)
    periode_debut = Column(Date, nullable=False)
    periode_fin = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey('client.id'))
    file_url = Column(String)

    tenant = relationship('Tenant')
    client = relationship('Client')
