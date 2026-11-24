from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FamilyMemberFields(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    relationship: str = Field(min_length=1, max_length=80)
    date_of_birth: date | None = None
    occupation: str | None = Field(default=None, max_length=120)
    annual_income: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class FamilyMemberCreate(FamilyMemberFields):
    pass


class FamilyMemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    relationship: str | None = Field(default=None, min_length=1, max_length=80)
    date_of_birth: date | None = None
    occupation: str | None = Field(default=None, max_length=120)
    annual_income: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)


class FamilyMemberResponse(FamilyMemberFields):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
