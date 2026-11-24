import logging
from typing import Any

from app.core.errors import SupabaseRequestError

logger = logging.getLogger("cas.activity")


async def record_activity(
    service,
    user,
    event_type: str,
    summary: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        await service.request_rest(
            "POST",
            "activity_logs",
            access_token=user.access_token,
            payload={
                "user_id": str(user.id),
                "event_type": event_type,
                "summary": summary,
                "metadata": metadata or {},
            },
        )
    except SupabaseRequestError:
        logger.warning("Could not save activity event %s.", event_type)


async def create_notification(
    service,
    user,
    title: str,
    body: str,
) -> None:
    try:
        await service.request_rest(
            "POST",
            "notifications",
            access_token=user.access_token,
            payload={"user_id": str(user.id), "title": title, "body": body},
        )
    except SupabaseRequestError:
        logger.warning("Could not save notification %s.", title)
