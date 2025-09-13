from typing import List

from pydantic import BaseModel


class CategoryRead(BaseModel):
    id: int
    name: str


class ClientWithCategories(BaseModel):
    id: int
    name: str
    categories: List[CategoryRead]
