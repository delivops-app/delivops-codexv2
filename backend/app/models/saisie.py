from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class Saisie(Base):
    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    tournee_id = Column(Integer, ForeignKey("tournee.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    groupe_colis = Column(String, nullable=False)
    nb_recup = Column(Integer, default=0)
    nb_livres = Column(Integer, default=0)
    commentaire = Column(String, nullable=True)

    tenant = relationship("Tenant")
    tournee = relationship("Tournee")
