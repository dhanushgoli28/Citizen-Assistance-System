from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, Field, field_validator, model_validator

LegalCategory = Literal[
    "general",
    "rights_welfare",
    "consumer",
    "employment",
    "rti",
    "property",
    "civil",
]


class LegalHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message content cannot be blank.")
        return value.strip()


class LegalChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    category: LegalCategory = "general"
    conversation_id: UUID | None = None
    history: list[LegalHistoryMessage] = Field(default_factory=list, max_length=8)

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Message cannot be blank.")
        return value.strip()

    @model_validator(mode="after")
    def history_size_is_limited(self):
        if sum(len(item.content) for item in self.history) > 8000:
            raise ValueError("Conversation context is too long.")
        return self


class LegalSource(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    url: AnyHttpUrl


class LegalChatResponse(BaseModel):
    conversation_id: UUID | None = None
    answer: str = Field(min_length=1, max_length=6000)
    sources: list[LegalSource] = Field(default_factory=list, max_length=6)
    grounded: bool
    disclaimer: str
