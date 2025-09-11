from decimal import Decimal
from pydantic import BaseModel


class TarifBase(BaseModel):
    client_id: int
    groupe_colis: str
    mode: str
    montant_unitaire: Decimal
    prime_seuil_nb_colis: int | None = 0
    prime_montant: Decimal | None = Decimal("0")
    actif: bool | None = True


class TarifCreate(TarifBase):
    pass


class TarifUpdate(BaseModel):
    client_id: int | None = None
    groupe_colis: str | None = None
    mode: str | None = None
    montant_unitaire: Decimal | None = None
    prime_seuil_nb_colis: int | None = None
    prime_montant: Decimal | None = None
    actif: bool | None = None


class TarifRead(TarifBase):
    id: int

    class Config:
        orm_mode = True
