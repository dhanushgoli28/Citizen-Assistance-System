from datetime import datetime, timezone
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError
from app.services.activity import record_activity

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(user: CurrentUser, service: CurrentService):
    try:
        return await service.request_rest(
            "GET",
            f"notifications?{urlencode({'select': 'id,title,body,read_at,created_at', 'order': 'created_at.desc', 'limit': '100'})}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "PATCH",
            f"notifications?{urlencode({'id': f'eq.{notification_id}', 'select': 'id,title,body,read_at,created_at'})}",
            access_token=user.access_token,
            payload={"read_at": datetime.now(timezone.utc).isoformat()},
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Notification not found.")
    await record_activity(service, user, "notification.read", "Read a notification.")
    return rows[0]
