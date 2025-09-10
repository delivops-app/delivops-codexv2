from pydantic import BaseModel


class ChauffeurCreate(BaseModel):
    email: str
    display_name: str


class ChauffeurRead(BaseModel):
    id: int
    email: str
    display_name: str
    is_active: bool

    class Config:
        orm_mode = True
