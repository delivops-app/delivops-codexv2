from decimal import Decimal
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship

from .base import Base


class Tarif(Base):
    tenant_id = Column(Integer, ForeignKey('tenant.id'), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey('client.id'), nullable=False, index=True)
    groupe_colis = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    montant_unitaire = Column(Numeric(10, 2), default=Decimal('0'))
    prime_seuil_nb_colis = Column(Integer, default=0)
    prime_montant = Column(Numeric(10, 2), default=Decimal('0'))
    actif = Column(Boolean, default=True)

    tenant = relationship('Tenant')
    client = relationship('Client')
