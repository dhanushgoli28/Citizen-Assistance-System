from uuid import UUID

from fastapi.testclient import TestClient

from app.api.dependencies import get_supabase_service, require_user
from app.api.routers.legal import get_gemini_legal_service
from app.main import app
from app.schemas.auth import AuthenticatedUser
from app.schemas.legal import LegalChatResponse

USER_ID = UUID("f63d0a6e-59eb-4c7f-aa72-e3195f8ca4f2")
CONVERSATION_ID = UUID("95aa04d2-fde0-4555-a0c9-cdb20f0756a3")


class StubDatabase:
    def __init__(self, history=None):
        self.calls = []
        self.history = history or []

    async def request_rest(
        self, method, endpoint, *, access_token=None, payload=None, prefer=None
    ):
        self.calls.append((method, endpoint, access_token, payload))
        if method == "POST" and endpoint == "legal_conversations":
            return [{"id": str(CONVERSATION_ID)}]
        if method == "GET" and endpoint.startswith("legal_conversations?"):
            return [{"id": str(CONVERSATION_ID), "category": "general"}]
        if method == "GET" and endpoint.startswith("legal_messages?"):
            return self.history
        return []


class StubGemini:
    def __init__(self):
        self.requests = []

    async def answer(self, request):
        self.requests.append(request)
        return LegalChatResponse(
            answer="Check the official government service for current guidance.",
            sources=[{
                "title": "Official service",
                "url": "https://example.gov.in/service",
            }],
            grounded=True,
            disclaimer="General information only.",
        )


def _client(database, gemini):
    user = AuthenticatedUser(
        id=USER_ID,
        email="citizen@example.com",
        access_token="test-user-token",
    )
    app.dependency_overrides[require_user] = lambda: user
    app.dependency_overrides[get_supabase_service] = lambda: database
    app.dependency_overrides[get_gemini_legal_service] = lambda: gemini
    return TestClient(app)


def test_new_legal_conversation_and_messages_are_saved_with_user_token():
    database = StubDatabase()
    gemini = StubGemini()
    app.dependency_overrides.clear()
    try:
        with _client(database, gemini) as client:
            response = client.post(
                "/api/legal/chat",
                json={"message": "Where can I find service information?"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["conversation_id"] == str(CONVERSATION_ID)
    assert [call[1] for call in database.calls] == [
        "legal_conversations",
        "legal_messages",
        "legal_messages",
        "activity_logs",
    ]
    assert all(call[2] == "test-user-token" for call in database.calls)
    message_calls = [call for call in database.calls if call[1] == "legal_messages"]
    assert message_calls[-1][3]["source_references"][0]["url"] == (
        "https://example.gov.in/service"
    )


def test_followup_uses_saved_conversation_context_not_client_supplied_history():
    database = StubDatabase([
        {"role": "assistant", "content": "Stored earlier answer"},
        {"role": "user", "content": "Stored earlier question"},
    ])
    gemini = StubGemini()
    app.dependency_overrides.clear()
    try:
        with _client(database, gemini) as client:
            response = client.post(
                "/api/legal/chat",
                json={
                    "message": "What is the next step?",
                    "conversation_id": str(CONVERSATION_ID),
                    "history": [{"role": "user", "content": "Untrusted client history"}],
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert [
        (item.role, item.content) for item in gemini.requests[0].history
    ] == [
        ("user", "Stored earlier question"),
        ("assistant", "Stored earlier answer"),
    ]
    assert "Untrusted client history" not in repr(gemini.requests[0].history)
