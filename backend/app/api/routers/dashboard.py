from fastapi import APIRouter, HTTPException
from urllib.parse import urlencode

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _query(
    table: str,
    user_id: str | None,
    fields: str,
    limit: int = 50,
    filters: dict[str, str] | None = None,
) -> str:
    params = {"select": fields, "limit": str(limit)}
    if user_id:
        params["user_id"] = f"eq.{user_id}"
    if filters:
        params.update(filters)
    if table == "applications":
        params["order"] = "updated_at.desc"
    elif table in {"documents", "activity_logs", "notifications"}:
        params["order"] = "created_at.desc"
    return f"{table}?{urlencode(params)}"


@router.get("")
async def get_dashboard(user: CurrentUser, service: CurrentService) -> dict:
    user_id = str(user.id)
    queries = {
        "profile": f"profiles?id=eq.{user_id}&select=*",
        "schemes": _query(
            "schemes",
            None,
            "id,name,summary,jurisdiction,state,category,official_source_url,application_url,verified_at",
            5,
            {"is_published": "eq.true"},
        ),
        "applications": _query(
            "applications",
            user_id,
            "id,application_type,status,updated_at",
        ),
        "documents": _query(
            "documents",
            user_id,
            "id,original_filename,document_type,status,created_at",
        ),
        "notifications": _query(
            "notifications",
            user_id,
            "id,title,body,read_at,created_at",
        ),
        "activity": _query(
            "activity_logs",
            user_id,
            "id,event_type,summary,created_at",
        ),
    }

    try:
        results = {}
        for key, endpoint in queries.items():
            rows = await service.request_rest(
                "GET",
                endpoint,
                access_token=user.access_token,
            )
            results[key] = rows[0] if key == "profile" and rows else (
                None if key == "profile" else rows
            )
    except SupabaseRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    results["counts"] = {
        "applications": len(results["applications"]),
        "documents": len(results["documents"]),
        "unread_notifications": sum(
            notification["read_at"] is None
            for notification in results["notifications"]
        ),
    }
    return results
