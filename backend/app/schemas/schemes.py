from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class SchemeResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    summary: str
    jurisdiction: Literal["central", "state"]
    state: str | None = None
    category: str
    official_source_url: HttpUrl
    application_url: HttpUrl | None = None
    verified_at: date | None = None
    model_config = ConfigDict(extra="ignore")


class EligibilityRuleResult(BaseModel):
    criterion: str
    status: Literal["pass", "fail", "missing", "unsupported"]
    explanation: str
    actual_value: Any | None = None
    expected_value: Any


class EligibilityResponse(BaseModel):
    scheme_id: UUID
    status: Literal["eligible", "ineligible", "needs_information", "no_rules"]
    is_eligible: bool | None
    rules: list[EligibilityRuleResult]
    missing_information: list[str] = Field(default_factory=list)
    official_source_url: HttpUrl
    verified_at: date | None = None
