from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.family import FamilyMemberCreate, FamilyMemberResponse, FamilyMemberUpdate
from app.services.activity import record_activity

router = APIRouter(prefix="/users/family", tags=["family"])


def _raise_database_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _member_query(member_id: UUID | None = None) -> str:
    params = {"select": "*"}
    if member_id:
        params["id"] = f"eq.{member_id}"
    else:
        params["order"] = "created_at.asc"
    return f"family_members?{urlencode(params)}"


@router.get("", response_model=list[FamilyMemberResponse])
async def list_family(user: CurrentUser, service: CurrentService):
    try:
        return await service.request_rest(
            "GET",
            _member_query(),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _raise_database_error(exc) from exc


@router.post("", response_model=FamilyMemberResponse, status_code=201)
async def add_family_member(
    payload: FamilyMemberCreate,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "POST",
            "family_members?select=*",
            access_token=user.access_token,
            payload={"user_id": str(user.id), **payload.model_dump(mode="json")},
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise _raise_database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return the saved family member.")
    await record_activity(service, user, "family_member.added", "Added a family member.")
    return rows[0]


@router.patch("/{member_id}", response_model=FamilyMemberResponse)
async def update_family_member(
    member_id: UUID,
    payload: FamilyMemberUpdate,
    user: CurrentUser,
    service: CurrentService,
):
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=422, detail="Provide at least one family-member field to update.")
    try:
        rows = await service.request_rest(
            "PATCH",
            _member_query(member_id),
            access_token=user.access_token,
            payload=data,
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise _raise_database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Family member not found.")
    await record_activity(service, user, "family_member.updated", "Updated a family member.")
    return rows[0]


@router.delete("/{member_id}", status_code=204)
async def delete_family_member(
    member_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "DELETE",
            _member_query(member_id),
            access_token=user.access_token,
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise _raise_database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Family member not found.")
    await record_activity(service, user, "family_member.removed", "Removed a family member.")
    return Response(status_code=204)
