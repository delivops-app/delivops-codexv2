from pydantic import BaseModel


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

    class Config:
        orm_mode = True
