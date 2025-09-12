from datetime import date
from decimal import Decimal
from typing import List

from pydantic import BaseModel, Field, ConfigDict, conint


class TourItemCreate(BaseModel):
    tariff_group_id: int = Field(alias="tariffGroupId")
    quantity: conint(ge=0)

    model_config = ConfigDict(populate_by_name=True)


class TourCreate(BaseModel):
    date: date
    client_id: int = Field(alias="clientId")
    items: List[TourItemCreate]

    model_config = ConfigDict(populate_by_name=True)


class TourItemRead(BaseModel):
    tariff_group_id: int = Field(alias="tariffGroupId")
    display_name: str = Field(alias="displayName")
    quantity: int
    unit_price_ex_vat: Decimal = Field(alias="unitPriceExVat")
    amount_ex_vat: Decimal = Field(alias="amountExVat")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TourTotals(BaseModel):
    qty: int
    amount_ex_vat: Decimal = Field(alias="amountExVat")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TourRead(BaseModel):
    tour_id: int = Field(alias="tourId")
    date: date
    driver: dict
    client: dict
    items: List[TourItemRead]
    totals: TourTotals

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class DeclarationReportLine(BaseModel):
    date: date
    driver_name: str = Field(alias="driverName")
    client_name: str = Field(alias="clientName")
    tariff_group_display_name: str = Field(alias="tariffGroupDisplayName")
    quantity: int
    estimated_amount_eur: Decimal = Field(alias="estimatedAmountEur")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
