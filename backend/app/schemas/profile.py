from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=1000)
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    occupation: str | None = Field(default=None, max_length=120)
    annual_income: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class ProfileResponse(ProfileUpdate):
    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
