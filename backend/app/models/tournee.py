from sqlalchemy import Column, Integer, String, Date, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship

from .base import Base


class Tournee(Base):
    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    chauffeur_id = Column(
        Integer, ForeignKey("chauffeur.id"), nullable=False, index=True
    )
    client_id = Column(Integer, ForeignKey("client.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    numero_ordre = Column(Integer, nullable=False)
    statut = Column(String, nullable=False, default="DRAFT")

    __table_args__ = (CheckConstraint("numero_ordre BETWEEN 1 AND 3"),)

    tenant = relationship("Tenant", backref="tournees")
    chauffeur = relationship("Chauffeur", backref="tournees")
    client = relationship("Client", backref="tournees")
    saisies = relationship("Saisie", back_populates="tournee")
