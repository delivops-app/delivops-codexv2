from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChauffeurCreate(BaseModel):
    email: str
    display_name: str


class ChauffeurUpdate(BaseModel):
    email: str | None = None
    display_name: str | None = None
    is_active: bool | None = None


class ChauffeurRead(BaseModel):
    id: int
    email: str
    display_name: str
    is_active: bool
    last_seen_at: datetime | None

    # Allow reading data from ORM objects with Pydantic v2
    model_config = ConfigDict(from_attributes=True)
