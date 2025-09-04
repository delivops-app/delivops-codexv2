from datetime import date
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from decimal import Decimal

from .base import Base


class PaieCycle(Base):
    tenant_id = Column(Integer, ForeignKey('tenant.id'), nullable=False)
    client_id = Column(Integer, ForeignKey('client.id'), nullable=False)
    periode_debut = Column(Date, nullable=False)
    periode_fin = Column(Date, nullable=False)
    statut = Column(String, nullable=False, default='BROUILLON')

    tenant = relationship('Tenant')
    client = relationship('Client')
    lignes = relationship('PaieLigne', backref='cycle')


class PaieLigne(Base):
    cycle_id = Column(Integer, ForeignKey('paiecycle.id'), nullable=False)
    chauffeur_id = Column(Integer, ForeignKey('chauffeur.id'), nullable=False)
    total_colis = Column(Integer, default=0)
    montant_base = Column(Numeric(10,2), default=Decimal('0'))
    primes = Column(Numeric(10,2), default=Decimal('0'))
    total_paye = Column(Numeric(10,2), default=Decimal('0'))
    details_json = Column(String)
