import json
from typing import Literal
from uuid import UUID

import httpx

from app.core.config import Settings
from app.core.errors import SupabaseRequestError

DocumentStatus = Literal["uploaded", "processing", "processed", "failed"]
ApplicationStatus = Literal["draft", "pending", "completed"]


class SupabaseSystemStatusService:
    """Server-only access to the two status RPCs; never expose this as a user route."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient):
        self.settings = settings
        self.client = client

    async def set_document_status(
        self,
        document_id: UUID,
        status: DocumentStatus,
    ) -> None:
        if status not in {"uploaded", "processing", "processed", "failed"}:
            raise SupabaseRequestError(422, "Invalid document status.")
        await self._call_status_rpc(
            "set_document_status",
            {"p_document_id": str(document_id), "p_status": status},
        )

    async def set_application_status(
        self,
        application_id: UUID,
        status: ApplicationStatus,
    ) -> None:
        if status not in {"draft", "pending", "completed"}:
            raise SupabaseRequestError(422, "Invalid application status.")
        await self._call_status_rpc(
            "set_application_status",
            {"p_application_id": str(application_id), "p_status": status},
        )

    async def _call_status_rpc(self, function_name: str, payload: dict) -> None:
        service_key = self.settings.supabase_service_role_key
        if not self.settings.supabase_configured:
            raise SupabaseRequestError(503, "Supabase is not configured on the server.")
        if not service_key:
            raise SupabaseRequestError(
                503,
                "System status updates require a server-side Supabase service-role key.",
            )

        url = f"{str(self.settings.supabase_url).rstrip('/')}/rest/v1/rpc/{function_name}"
        headers = {
            "apikey": self.settings.supabase_anon_key or "",
            "Authorization": f"Bearer {service_key.get_secret_value()}",
        }
        try:
            response = await self.client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise SupabaseRequestError(
                503,
                "Supabase status service is temporarily unavailable.",
            ) from exc

        if response.is_error:
            message = "Supabase rejected the system status update."
            try:
                body = response.json()
            except (json.JSONDecodeError, ValueError):
                body = None
            if isinstance(body, dict):
                detail = body.get("message") or body.get("msg")
                if isinstance(detail, str) and detail.strip():
                    message = detail[:300]
            status_code = response.status_code if response.status_code < 500 else 502
            raise SupabaseRequestError(status_code, message)
