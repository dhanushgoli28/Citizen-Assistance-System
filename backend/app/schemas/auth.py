from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)
    code_challenge: str | None = Field(
        default=None,
        min_length=43,
        max_length=43,
        pattern=r"^[A-Za-z0-9_-]{43}$",
    )
    code_challenge_method: Literal["s256"] | None = None

    @model_validator(mode="after")
    def validate_pkce_parameters(self):
        if (self.code_challenge is None) != (self.code_challenge_method is None):
            raise ValueError("Both PKCE challenge and method must be provided together.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class PasswordResetRequest(BaseModel):
    email: EmailStr
    code_challenge: str | None = Field(
        default=None,
        min_length=43,
        max_length=43,
        pattern=r"^[A-Za-z0-9_-]{43}$",
    )
    code_challenge_method: Literal["s256"] | None = None

    @model_validator(mode="after")
    def validate_pkce_parameters(self):
        if (self.code_challenge is None) != (self.code_challenge_method is None):
            raise ValueError("Both PKCE challenge and method must be provided together.")
        return self


class EmailResendRequest(BaseModel):
    email: EmailStr
    type: Literal["signup"] = "signup"
    code_challenge: str | None = Field(
        default=None,
        min_length=43,
        max_length=43,
        pattern=r"^[A-Za-z0-9_-]{43}$",
    )
    code_challenge_method: Literal["s256"] | None = None

    @model_validator(mode="after")
    def validate_pkce_parameters(self):
        if (self.code_challenge is None) != (self.code_challenge_method is None):
            raise ValueError("Both PKCE challenge and method must be provided together.")
        return self


class EmailVerificationRequest(BaseModel):
    token_hash: str = Field(min_length=1, max_length=512)
    type: Literal["signup", "recovery"]


class PasswordUpdateRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class AuthCodeExchangeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=2048)
    code_verifier: str = Field(
        min_length=43,
        max_length=128,
        pattern=r"^[A-Za-z0-9._~-]+$",
    )


class SupabaseUser(BaseModel):
    id: str
    email: EmailStr | None = None
    user_metadata: dict = Field(default_factory=dict)
    model_config = ConfigDict(extra="ignore")


class AuthSessionResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    token_type: str | None = None
    user: SupabaseUser | None = None
    message: str | None = None
    model_config = ConfigDict(extra="ignore")


class AuthenticatedUser(BaseModel):
    id: UUID
    email: EmailStr | None = None
    user_metadata: dict = Field(default_factory=dict)
    access_token: str = Field(exclude=True)
    model_config = ConfigDict(extra="ignore")
