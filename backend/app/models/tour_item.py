from decimal import Decimal

from sqlalchemy import Column, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from .base import Base


class TourItem(Base):
    """Line of declaration with snapshot of the applied tariff."""

    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    tour_id = Column(Integer, ForeignKey("tour.id"), nullable=False, index=True)
    tariff_group_id = Column(
        Integer, ForeignKey("tariffgroup.id"), nullable=False, index=True
    )
    pickup_quantity = Column(Integer, nullable=False, default=0)
    delivery_quantity = Column(Integer, nullable=False, default=0)
    unit_price_ex_vat_snapshot = Column(Numeric(10, 2), default=Decimal("0"))
    amount_ex_vat_snapshot = Column(Numeric(10, 2), default=Decimal("0"))

    tour = relationship("Tour", back_populates="items")
    tariff_group = relationship("TariffGroup")
    tenant = relationship("Tenant")
