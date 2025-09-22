from datetime import date
from decimal import Decimal
from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field, conint


class TourItemPickupCreate(BaseModel):
    tariff_group_id: int = Field(alias="tariffGroupId")
    pickup_quantity: conint(ge=0) = Field(alias="pickupQuantity")

    model_config = ConfigDict(populate_by_name=True)


class TourPickupCreate(BaseModel):
    date: date
    client_id: int = Field(alias="clientId")
    items: List[TourItemPickupCreate]

    model_config = ConfigDict(populate_by_name=True)


class TourItemDeliveryUpdate(BaseModel):
    tariff_group_id: int = Field(alias="tariffGroupId")
    delivery_quantity: conint(ge=0) = Field(alias="deliveryQuantity")

    model_config = ConfigDict(populate_by_name=True)


class TourDeliveryUpdate(BaseModel):
    items: List[TourItemDeliveryUpdate]

    model_config = ConfigDict(populate_by_name=True)


class TourItemRead(BaseModel):
    tariff_group_id: int = Field(alias="tariffGroupId")
    display_name: str = Field(alias="displayName")
    pickup_quantity: int = Field(alias="pickupQuantity")
    delivery_quantity: int = Field(alias="deliveryQuantity")
    difference: int
    unit_price_ex_vat: Decimal = Field(alias="unitPriceExVat")
    amount_ex_vat: Decimal = Field(alias="amountExVat")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TourTotals(BaseModel):
    pickup_qty: int = Field(alias="pickupQty")
    delivery_qty: int = Field(alias="deliveryQty")
    difference_qty: int = Field(alias="differenceQty")
    amount_ex_vat: Decimal = Field(alias="amountExVat")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TourRead(BaseModel):
    tour_id: int = Field(alias="tourId")
    date: date
    status: Literal["IN_PROGRESS", "COMPLETED"]
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
    pickup_quantity: int = Field(alias="pickupQuantity")
    delivery_quantity: int = Field(alias="deliveryQuantity")
    difference_quantity: int = Field(alias="differenceQuantity")
    estimated_amount_eur: Decimal = Field(alias="estimatedAmountEur")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
