import json
from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import SupabaseRequestError


class SupabaseService:
    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client

    def _base_url(self) -> str:
        if not self.settings.supabase_configured:
            raise SupabaseRequestError(503, "Supabase is not configured on the server.")
        return str(self.settings.supabase_url).rstrip("/")

    def _headers(self, access_token: str | None = None) -> dict[str, str]:
        headers = {"apikey": self.settings.supabase_anon_key or ""}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        return headers

    @staticmethod
    def _error_message(response: httpx.Response) -> str:
        try:
            body: Any = response.json()
        except (json.JSONDecodeError, ValueError):
            return "The Supabase request could not be completed."
        if isinstance(body, dict):
            message = body.get("msg") or body.get("message") or body.get("error_description")
            if isinstance(message, str) and message.strip():
                return message[:300]
        return "The Supabase request could not be completed."

    async def request_auth(
        self,
        method: str,
        endpoint: str,
        *,
        payload: dict | None = None,
        access_token: str | None = None,
    ) -> dict:
        url = f"{self._base_url()}/auth/v1/{endpoint.lstrip('/')}"
        try:
            response = await self.client.request(
                method,
                url,
                json=payload,
                headers=self._headers(access_token),
            )
        except httpx.RequestError as exc:
            raise SupabaseRequestError(503, "Supabase Auth is temporarily unavailable.") from exc
        if response.is_error:
            status = response.status_code if response.status_code < 500 else 502
            raise SupabaseRequestError(status, self._error_message(response))
        if not response.content:
            return {}
        return response.json()

    async def request_rest(
        self,
        method: str,
        endpoint: str,
        *,
        access_token: str,
        payload: dict | None = None,
        prefer: str | None = None,
    ) -> Any:
        url = f"{self._base_url()}/rest/v1/{endpoint.lstrip('/')}"
        headers = self._headers(access_token)
        if prefer:
            headers["Prefer"] = prefer
        try:
            response = await self.client.request(
                method,
                url,
                json=payload,
                headers=headers,
            )
        except httpx.RequestError as exc:
            raise SupabaseRequestError(503, "Supabase Database is temporarily unavailable.") from exc
        if response.is_error:
            status = response.status_code if response.status_code < 500 else 502
            raise SupabaseRequestError(status, self._error_message(response))
        if not response.content:
            return None
        return response.json()

    async def request_storage(
        self,
        method: str,
        endpoint: str,
        *,
        access_token: str,
        content: bytes | None = None,
        content_type: str | None = None,
        payload: dict | None = None,
    ) -> bytes:
        url = f"{self._base_url()}/storage/v1/{endpoint.lstrip('/')}"
        headers = self._headers(access_token)
        if content_type:
            headers["Content-Type"] = content_type
        try:
            response = await self.client.request(
                method,
                url,
                content=content,
                json=payload,
                headers=headers,
            )
        except httpx.RequestError as exc:
            raise SupabaseRequestError(503, "Supabase Storage is temporarily unavailable.") from exc
        if response.is_error:
            status = response.status_code if response.status_code < 500 else 502
            raise SupabaseRequestError(status, self._error_message(response))
        return response.content
