from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.profile import ProfileResponse, ProfileUpdate
from app.services.activity import record_activity

router = APIRouter(prefix="/users", tags=["users"])


def _database_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _profile_query(user_id: str) -> str:
    return f"profiles?id=eq.{UUID(user_id)}&select=*"


@router.get("/profile", response_model=ProfileResponse | None)
async def get_profile(user: CurrentUser, service: CurrentService) -> Any:
    try:
        rows = await service.request_rest(
            "GET",
            _profile_query(user.id),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    return rows[0] if rows else None


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    payload: ProfileUpdate,
    user: CurrentUser,
    service: CurrentService,
) -> Any:
    data = payload.model_dump(exclude_unset=True, mode="json")
    try:
        rows = await service.request_rest(
            "GET",
            _profile_query(user.id),
            access_token=user.access_token,
        )
        if rows:
            result = await service.request_rest(
                "PATCH",
                _profile_query(user.id),
                access_token=user.access_token,
                payload=data,
                prefer="return=representation",
            )
        else:
            profile_name = (
                data.pop("full_name", None)
                or user.user_metadata.get("full_name")
                or (str(user.email).split("@", 1)[0] if user.email else "Citizen")
            )
            result = await service.request_rest(
                "POST",
                "profiles",
                access_token=user.access_token,
                payload={"id": str(user.id), "full_name": profile_name, **data},
                prefer="return=representation",
            )
    except (SupabaseRequestError, ValueError) as exc:
        if isinstance(exc, SupabaseRequestError):
            raise _database_error(exc) from exc
        raise HTTPException(status_code=401, detail="Invalid authenticated user.") from exc
    if not result:
        raise HTTPException(status_code=502, detail="Supabase did not return the saved profile.")
    await record_activity(service, user, "profile.updated", "Updated profile information.")
    return result[0]
