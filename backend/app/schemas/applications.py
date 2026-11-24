from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


ApplicationStatus = Literal["draft", "pending", "completed"]


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheme_id: UUID | None = None
    application_type: str = Field(min_length=1, max_length=200)
    form_data: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def limit_form_data(self):
        if len(str(self.form_data)) > 20_000:
            raise ValueError("Application form data is too large.")
        return self


class ApplicationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scheme_id: UUID | None = None
    application_type: str | None = Field(default=None, min_length=1, max_length=200)
    form_data: dict | None = None

    @model_validator(mode="after")
    def limit_form_data(self):
        if self.form_data is not None and len(str(self.form_data)) > 20_000:
            raise ValueError("Application form data is too large.")
        if "application_type" in self.model_fields_set and self.application_type is None:
            raise ValueError("Application type cannot be null.")
        if "form_data" in self.model_fields_set and self.form_data is None:
            raise ValueError("Form data cannot be null.")
        return self


class ApplicationResponse(BaseModel):
    id: UUID
    user_id: UUID
    scheme_id: UUID | None = None
    application_type: str
    status: ApplicationStatus
    form_data: dict
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(extra="ignore")


class ExternalSubmissionConfirmation(BaseModel):
    confirmed_external_submission: Literal[True]


class FormValidateRequest(BaseModel):
    template_id: Literal["general_support", "housing_support", "education_support"]
    data: dict = Field(default_factory=dict)


class FormDraftRequest(FormValidateRequest):
    scheme_id: UUID | None = None
