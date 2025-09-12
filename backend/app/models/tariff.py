from decimal import Decimal

from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship

from .base import Base


class Tariff(Base):
    """Price definition for a tariff group with effectivity dates."""

    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    tariff_group_id = Column(
        Integer, ForeignKey("tariffgroup.id"), nullable=False, index=True
    )
    price_ex_vat = Column(Numeric(10, 2), default=Decimal("0"))
    vat_rate = Column(Numeric(5, 2), default=Decimal("0"))
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)

    tenant = relationship("Tenant")
    tariff_group = relationship("TariffGroup", back_populates="tariffs")

