from functools import lru_cache

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Citizen Assistance System API"
    environment: str = "development"
    supabase_url: AnyHttpUrl | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: SecretStr | None = None
    auth_email_redirect_url: AnyHttpUrl = Field(
        default="http://127.0.0.1:5173/auth/callback",
    )
    gemini_api_key: SecretStr | None = None
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        pattern=r"^gemini-[A-Za-z0-9._-]{1,80}$",
    )
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    rate_limit_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator(
        "supabase_url",
        "supabase_anon_key",
        "supabase_service_role_key",
        "gemini_api_key",
        mode="before",
    )
    @classmethod
    def empty_string_is_unconfigured(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def supabase_configured(self) -> bool:
        return self.supabase_url is not None and bool(self.supabase_anon_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
