from decimal import Decimal
from typing import List

from pydantic import BaseModel, Field, ConfigDict


class CategoryRead(BaseModel):
    id: int
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )
    margin_ex_vat: Decimal | None = Field(default=None, alias="marginExVat")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class CategoryCreate(BaseModel):
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )
    margin_ex_vat: Decimal | None = Field(default=None, alias="marginExVat")


class CategoryUpdate(BaseModel):
    name: str
    unit_price_ex_vat: Decimal | None = Field(
        default=None, alias="unitPriceExVat"
    )
    margin_ex_vat: Decimal | None = Field(default=None, alias="marginExVat")


class ClientWithCategories(BaseModel):
    id: int
    name: str
    is_active: bool = Field(alias="isActive")
    categories: List[CategoryRead]

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ClientCreate(BaseModel):
    name: str


class ClientUpdate(BaseModel):
    name: str
