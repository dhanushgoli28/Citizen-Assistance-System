from fastapi import APIRouter, HTTPException

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.applications import FormDraftRequest, FormValidateRequest
from app.services.activity import record_activity

router = APIRouter(prefix="/forms", tags=["smart forms"])

TEMPLATES = {
    "general_support": {
        "label": "General assistance request draft",
        "required": ["full_name", "phone", "address", "request_summary"],
    },
    "housing_support": {
        "label": "Housing assistance enquiry draft",
        "required": ["full_name", "phone", "address", "household_size", "request_summary"],
    },
    "education_support": {
        "label": "Education assistance enquiry draft",
        "required": ["full_name", "phone", "course_or_class", "institution", "request_summary"],
    },
}


@router.get("/templates")
async def list_form_templates():
    return [
        {
            "id": template_id,
            "label": template["label"],
            "required_fields": template["required"],
            "official_form": False,
        }
        for template_id, template in TEMPLATES.items()
    ]


@router.post("/validate")
async def validate_form(payload: FormValidateRequest):
    required = TEMPLATES[payload.template_id]["required"]
    missing = [
        field for field in required
        if payload.data.get(field) is None or not str(payload.data[field]).strip()
    ]
    return {
        "valid": not missing,
        "missing_fields": missing,
        "message": (
            "Required information is present."
            if not missing
            else "Complete the listed fields before saving the draft."
        ),
    }


@router.post("/generate", status_code=201)
async def generate_form_draft(
    payload: FormDraftRequest,
    user: CurrentUser,
    service: CurrentService,
):
    template = TEMPLATES[payload.template_id]
    data = dict(payload.data)
    try:
        profile_rows = await service.request_rest(
            "GET",
            f"profiles?id=eq.{user.id}&select=full_name,phone,address,state,district",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if profile_rows:
        for key, value in profile_rows[0].items():
            data.setdefault(key, value)
    missing = [
        field for field in template["required"]
        if data.get(field) is None or not str(data[field]).strip()
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "Required fields are missing.", "missing_fields": missing},
        )

    try:
        rows = await service.request_rest(
            "POST",
            "applications",
            access_token=user.access_token,
            payload={
                "user_id": str(user.id),
                "scheme_id": str(payload.scheme_id) if payload.scheme_id else None,
                "application_type": template["label"],
                "form_data": data,
            },
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    if not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return the saved draft.")
    await record_activity(
        service,
        user,
        "application.draft_created",
        "Saved a form draft.",
        {"application_id": rows[0]["id"]},
    )
    return rows[0]
