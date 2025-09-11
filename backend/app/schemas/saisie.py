from pydantic import BaseModel


class SaisieBase(BaseModel):
    tournee_id: int
    type: str
    groupe_colis: str
    nb_recup: int = 0
    nb_livres: int = 0
    commentaire: str | None = None


class SaisieCreate(SaisieBase):
    pass


class SaisieUpdate(BaseModel):
    type: str | None = None
    groupe_colis: str | None = None
    nb_recup: int | None = None
    nb_livres: int | None = None
    commentaire: str | None = None


class SaisieRead(SaisieBase):
    id: int

    class Config:
        orm_mode = True
