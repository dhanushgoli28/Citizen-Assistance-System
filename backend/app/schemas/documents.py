from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


DocumentStatus = Literal["uploaded", "processing", "processed", "failed"]


class DocumentResponse(BaseModel):
    id: UUID
    original_filename: str
    mime_type: Literal["application/pdf", "image/jpeg", "image/png"]
    file_size_bytes: int
    document_type: str | None = None
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(extra="ignore")


class DocumentExtractionResponse(BaseModel):
    document_id: UUID
    extracted_data: dict
    summary: str | None = None
    missing_information: list[str] = Field(default_factory=list)
    processing_method: Literal["text", "ocr"] | None = None
    document_type: str | None = None
    extracted_text: str | None = None
    created_at: datetime
    model_config = ConfigDict(extra="ignore")
