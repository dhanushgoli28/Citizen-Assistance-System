import io
from html import escape
import json
import re
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentService, CurrentSystemStatus, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    ExternalSubmissionConfirmation,
)
from app.services.activity import create_notification, record_activity

router = APIRouter(prefix="/applications", tags=["applications"])
APPLICATION_FIELDS = (
    "id,user_id,scheme_id,application_type,status,form_data,created_at,updated_at"
)


def _database_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _application_query(application_id: UUID | None = None) -> str:
    params = {"select": APPLICATION_FIELDS, "order": "updated_at.desc"}
    if application_id:
        params["id"] = f"eq.{application_id}"
    return f"applications?{urlencode(params)}"


async def _owned_application(application_id, user, service):
    try:
        rows = await service.request_rest(
            "GET",
            _application_query(application_id),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Application not found.")
    return rows[0]


@router.get("", response_model=list[ApplicationResponse])
async def list_applications(user: CurrentUser, service: CurrentService):
    try:
        return await service.request_rest(
            "GET",
            _application_query(),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc


@router.post("", response_model=ApplicationResponse, status_code=201)
async def create_application(
    payload: ApplicationCreate,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "POST",
            "applications",
            access_token=user.access_token,
            payload={
                "user_id": str(user.id),
                "scheme_id": str(payload.scheme_id) if payload.scheme_id else None,
                "application_type": payload.application_type,
                "form_data": payload.form_data,
            },
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return the saved application.")
    await record_activity(
        service,
        user,
        "application.created",
        "Created an application draft.",
        {"application_id": rows[0]["id"]},
    )
    return rows[0]


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    return await _owned_application(application_id, user, service)


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: UUID,
    payload: ApplicationUpdate,
    user: CurrentUser,
    service: CurrentService,
):
    existing = await _owned_application(application_id, user, service)
    if existing["status"] != "draft":
        raise HTTPException(status_code=409, detail="Only draft applications can be edited.")
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        raise HTTPException(status_code=422, detail="Provide at least one field to update.")
    try:
        rows = await service.request_rest(
            "PATCH",
            _application_query(application_id),
            access_token=user.access_token,
            payload=data,
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Draft application not found.")
    await record_activity(
        service,
        user,
        "application.updated",
        "Updated an application draft.",
        {"application_id": str(application_id)},
    )
    return rows[0]


@router.post("/{application_id}/confirm-submission", response_model=ApplicationResponse)
async def confirm_external_submission(
    application_id: UUID,
    payload: ExternalSubmissionConfirmation,
    user: CurrentUser,
    service: CurrentService,
    system_status: CurrentSystemStatus,
):
    existing = await _owned_application(application_id, user, service)
    if existing["status"] != "draft":
        raise HTTPException(status_code=409, detail="Only a draft can be marked as submitted.")
    try:
        await system_status.set_application_status(application_id, "pending")
        rows = await service.request_rest(
            "GET",
            _application_query(application_id),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=502, detail="Could not confirm the application status.")
    await record_activity(
        service,
        user,
        "application.submitted_externally",
        "Marked an application as submitted outside CitizenAssist.",
        {"application_id": str(application_id), "status": "pending"},
    )
    await create_notification(
        service,
        user,
        "Application tracking updated",
        "You confirmed that you submitted this application outside CitizenAssist.",
    )
    return rows[0]


@router.delete("/{application_id}", status_code=204)
async def delete_application(
    application_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    existing = await _owned_application(application_id, user, service)
    if existing["status"] != "draft":
        raise HTTPException(status_code=409, detail="Only draft applications can be deleted.")
    try:
        await service.request_rest(
            "DELETE",
            _application_query(application_id),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    await record_activity(
        service,
        user,
        "application.deleted",
        "Deleted an application draft.",
        {"application_id": str(application_id)},
    )
    return Response(status_code=204)


@router.get("/{application_id}/history")
async def application_history(
    application_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    await _owned_application(application_id, user, service)
    query = urlencode({
        "select": "id,event_type,summary,metadata,created_at",
        "metadata->>application_id": f"eq.{application_id}",
        "order": "created_at.desc",
        "limit": "50",
    })
    try:
        return await service.request_rest(
            "GET",
            f"activity_logs?{query}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc


@router.get("/{application_id}/documents")
async def application_documents(
    application_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    await _owned_application(application_id, user, service)
    query = urlencode({
        "select": "document_id",
        "application_id": f"eq.{application_id}",
        "order": "created_at.asc",
    })
    try:
        return await service.request_rest(
            "GET",
            f"application_documents?{query}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc


@router.post("/{application_id}/documents/{document_id}", status_code=204)
async def attach_document(
    application_id: UUID,
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    await _owned_application(application_id, user, service)
    try:
        await service.request_rest(
            "POST",
            "application_documents",
            access_token=user.access_token,
            payload={
                "application_id": str(application_id),
                "document_id": str(document_id),
            },
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    await record_activity(
        service,
        user,
        "application.document_attached",
        "Associated a private document with an application.",
        {"application_id": str(application_id), "document_id": str(document_id)},
    )
    return Response(status_code=204)


@router.delete("/{application_id}/documents/{document_id}", status_code=204)
async def detach_document(
    application_id: UUID,
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    await _owned_application(application_id, user, service)
    query = urlencode({
        "application_id": f"eq.{application_id}",
        "document_id": f"eq.{document_id}",
    })
    try:
        await service.request_rest(
            "DELETE",
            f"application_documents?{query}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    await record_activity(
        service,
        user,
        "application.document_detached",
        "Removed a private document from an application.",
        {"application_id": str(application_id), "document_id": str(document_id)},
    )
    return Response(status_code=204)


@router.get("/{application_id}/pdf")
async def export_application_pdf(
    application_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    application = await _owned_application(application_id, user, service)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF export is not installed on the server.") from exc

    output = io.BytesIO()
    document = SimpleDocTemplate(output, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("CitizenAssist — Application Draft", styles["Title"]),
        Spacer(1, 16),
        Paragraph(f"Application type: {application['application_type']}", styles["Heading2"]),
        Paragraph("Status: Draft — not submitted to any government department.", styles["Normal"]),
        Spacer(1, 12),
    ]
    for key, value in application["form_data"].items():
        safe_key = escape(str(key).replace("_", " ").title())
        safe_value = json.dumps(value, ensure_ascii=False) if isinstance(value, (dict, list)) else str(value)
        story.append(Paragraph(f"{safe_key}: {escape(safe_value)}", styles["BodyText"]))
        story.append(Spacer(1, 6))
    document.build(story)
    output.seek(0)
    filename = re.sub(r"[^A-Za-z0-9_-]", "_", application["application_type"])[:80]
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )
