from typing import List

from pydantic import BaseModel


class CategoryRead(BaseModel):
    id: int
    name: str


class CategoryCreate(BaseModel):
    name: str


class CategoryUpdate(BaseModel):
    name: str


class ClientWithCategories(BaseModel):
    id: int
    name: str
    categories: List[CategoryRead]


class ClientCreate(BaseModel):
    name: str


class ClientUpdate(BaseModel):
    name: str
