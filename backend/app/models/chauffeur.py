from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import expression
from sqlalchemy.orm import relationship

from .base import Base


class Chauffeur(Base):
    tenant_id = Column(Integer, ForeignKey("tenant.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    email = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    is_active = Column(
        Boolean,
        default=True,
        server_default=expression.true(),
        nullable=False,
    )
    last_seen_at = Column(DateTime, nullable=True)

    tenant = relationship("Tenant", backref="chauffeurs")
    user = relationship("User", backref="chauffeur", uselist=False)
