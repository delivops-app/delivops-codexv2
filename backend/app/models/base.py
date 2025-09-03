from datetime import datetime
from sqlalchemy.orm import declarative_base, declared_attr
from sqlalchemy import Column, DateTime, Integer


class CustomBase:
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


Base = declarative_base(cls=CustomBase)
