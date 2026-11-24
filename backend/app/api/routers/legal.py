from typing import Annotated
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.dependencies import CurrentService, CurrentUser
from app.core.config import get_settings
from app.core.errors import SupabaseRequestError
from app.core.limiter import limiter
from app.schemas.legal import LegalChatRequest, LegalChatResponse, LegalHistoryMessage
from app.services.gemini_legal import GeminiLegalError, GeminiLegalService
from app.services.activity import record_activity

router = APIRouter(prefix="/legal", tags=["legal assistant"])
CONVERSATION_FIELDS = "id,title,category,created_at,updated_at"


def get_gemini_legal_service(request: Request) -> GeminiLegalService:
    return GeminiLegalService(get_settings(), request.app.state.http_client)


LegalService = Annotated[
    GeminiLegalService,
    Depends(get_gemini_legal_service),
]


@router.post("/chat", response_model=LegalChatResponse)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    payload: LegalChatRequest,
    user: CurrentUser,
    database: CurrentService,
    service: LegalService,
) -> LegalChatResponse:
    history = []
    conversation_id = payload.conversation_id
    if conversation_id:
        conversation = await _get_conversation(database, user.access_token, conversation_id)
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        try:
            stored_messages = await database.request_rest(
                "GET",
                "legal_messages?"
                + urlencode(
                    {
                        "select": "role,content",
                        "conversation_id": f"eq.{conversation_id}",
                        "order": "created_at.desc",
                        "limit": "8",
                    }
                ),
                access_token=user.access_token,
            )
        except SupabaseRequestError as exc:
            raise HTTPException(
                status_code=503,
                detail="Conversation history could not be loaded.",
            ) from exc
        history = [
            LegalHistoryMessage(
                role=item["role"],
                content=item["content"][:1000],
            )
            for item in reversed(stored_messages)
        ]

    try:
        answer = await service.answer(
            payload.model_copy(update={"history": history})
        )
    except GeminiLegalError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    try:
        if conversation_id is None:
            rows = await database.request_rest(
                "POST",
                "legal_conversations",
                access_token=user.access_token,
                payload={
                    "user_id": str(user.id),
                    "title": payload.message[:200],
                    "category": payload.category,
                },
                prefer="return=representation",
            )
            if not rows:
                raise HTTPException(
                    status_code=503,
                    detail="Conversation history could not be saved.",
                )
            conversation_id = UUID(rows[0]["id"])
        else:
            await database.request_rest(
                "PATCH",
                f"legal_conversations?id=eq.{conversation_id}",
                access_token=user.access_token,
                payload={"category": payload.category},
            )
        await database.request_rest(
            "POST",
            "legal_messages",
            access_token=user.access_token,
            payload={
                "conversation_id": str(conversation_id),
                "role": "user",
                "content": payload.message,
            },
        )
        await database.request_rest(
            "POST",
            "legal_messages",
            access_token=user.access_token,
            payload={
                "conversation_id": str(conversation_id),
                "role": "assistant",
                "content": answer.answer,
                "source_references": [
                    {"title": source.title, "url": str(source.url)}
                    for source in answer.sources
                ],
            },
        )
        await record_activity(
            database,
            user,
            "legal.conversation_updated",
            "Saved a legal-assistant conversation.",
        )
    except SupabaseRequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="Conversation history could not be saved.",
        ) from exc
    return answer.model_copy(update={"conversation_id": conversation_id})


async def _get_conversation(database, access_token: str, conversation_id: UUID):
    try:
        rows = await database.request_rest(
            "GET",
            "legal_conversations?"
            + urlencode(
                {
                    "select": CONVERSATION_FIELDS,
                    "id": f"eq.{conversation_id}",
                }
            ),
            access_token=access_token,
        )
    except SupabaseRequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="Conversation history could not be loaded.",
        ) from exc
    return rows[0] if rows else None


@router.get("/conversations")
async def list_conversations(user: CurrentUser, database: CurrentService):
    try:
        return await database.request_rest(
            "GET",
            "legal_conversations?"
            + urlencode(
                {
                    "select": CONVERSATION_FIELDS,
                    "order": "updated_at.desc",
                    "limit": "50",
                }
            ),
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="Conversation history could not be loaded.",
        ) from exc


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: UUID,
    user: CurrentUser,
    database: CurrentService,
):
    if await _get_conversation(database, user.access_token, conversation_id) is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    try:
        rows = await database.request_rest(
            "GET",
            "legal_messages?"
            + urlencode(
                {
                    "select": "id,role,content,source_references,created_at",
                    "conversation_id": f"eq.{conversation_id}",
                    "order": "created_at.desc",
                    "limit": "100",
                }
            ),
            access_token=user.access_token,
        )
        return list(reversed(rows))
    except SupabaseRequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="Conversation history could not be loaded.",
        ) from exc
