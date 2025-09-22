from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .base import Base


class Tour(Base):
    """Header of a driver's declaration for a given day and client."""

    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("chauffeur.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("client.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    kind = Column(String, nullable=False, default="DELIVERY")

    __table_args__ = (
        CheckConstraint("kind IN ('PICKUP', 'DELIVERY')", name="ck_tour_kind"),
    )

    tenant = relationship("Tenant")
    driver = relationship("Chauffeur")
    client = relationship("Client")
    items = relationship(
        "TourItem", back_populates="tour", cascade="all, delete-orphan"
    )

