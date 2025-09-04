from sqlalchemy import Column, Integer, String

from .base import Base


class Tenant(Base):
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    timezone = Column(String, default="UTC")
    locale = Column(String, default="fr")
