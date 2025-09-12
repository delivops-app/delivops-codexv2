from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .base import Base


class TariffGroup(Base):
    """Grouping of tariffs for a given client.

    Tariff groups are parametrised by the administrator and can be global or
    client specific. They are versioned with validity dates and can be toggled
    on or off.
    """

    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("client.id"), nullable=True, index=True)
    code = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    valid_from = Column(Date, nullable=True)
    valid_to = Column(Date, nullable=True)

    tenant = relationship("Tenant")
    client = relationship("Client")
    tariffs = relationship("Tariff", back_populates="tariff_group")

