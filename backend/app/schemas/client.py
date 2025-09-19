from typing import List

from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class CategoryRead(BaseModel):
    id: int
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class CategoryCreate(BaseModel):
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )


class CategoryUpdate(BaseModel):
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )


class ClientWithCategories(BaseModel):
    id: int
    name: str
    categories: List[CategoryRead]


class ClientCreate(BaseModel):
    name: str


class ClientUpdate(BaseModel):
    name: str
