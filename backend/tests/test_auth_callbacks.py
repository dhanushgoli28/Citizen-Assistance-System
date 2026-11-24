from fastapi.testclient import TestClient
from fastapi import Request

from app.api.dependencies import get_supabase_service
from app.main import app


class StubAuthService:
    def __init__(self):
        self.calls = []

    async def request_auth(self, method, endpoint, *, payload=None, access_token=None):
        self.calls.append(
            {
                "method": method,
                "endpoint": endpoint,
                "payload": payload,
                "access_token": access_token,
            }
        )
        return {
            "access_token": "test-access-token",
            "refresh_token": "test-refresh-token",
            "user": {
                "id": "test-user",
                "email": "citizen@example.com",
                "user_metadata": {"full_name": "Citizen Example"},
            },
        }


def _client_with_stub(stub):
    def override_service(request: Request):
        return stub

    app.dependency_overrides[get_supabase_service] = override_service
    return TestClient(app)


def test_registration_sets_callback_url_and_pkce_challenge():
    stub = StubAuthService()
    app.dependency_overrides.clear()
    try:
        with _client_with_stub(stub) as client:
            response = client.post(
                "/api/auth/register",
                json={
                    "email": "citizen@example.com",
                    "password": "a-strong-password",
                    "full_name": "Citizen Example",
                    "code_challenge": "A" * 43,
                    "code_challenge_method": "s256",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert stub.calls[0]["method"] == "POST"
    assert stub.calls[0]["endpoint"] == (
        "signup?redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2Fauth%2Fcallback"
    )
    assert stub.calls[0]["payload"]["code_challenge"] == "A" * 43
    assert stub.calls[0]["payload"]["code_challenge_method"] == "s256"


def test_email_verification_token_hash_uses_signup_verification():
    stub = StubAuthService()
    app.dependency_overrides.clear()
    try:
        with _client_with_stub(stub) as client:
            response = client.post(
                "/api/auth/verify",
                json={"token_hash": "one-time-token-hash", "type": "signup"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert stub.calls[0]["endpoint"] == "verify"
    assert stub.calls[0]["payload"] == {
        "token_hash": "one-time-token-hash",
        "type": "signup",
    }


def test_resend_verification_keeps_callback_and_pkce_settings():
    stub = StubAuthService()
    app.dependency_overrides.clear()
    try:
        with _client_with_stub(stub) as client:
            response = client.post(
                "/api/auth/resend-verification",
                json={
                    "email": "citizen@example.com",
                    "code_challenge": "B" * 43,
                    "code_challenge_method": "s256",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert stub.calls[0]["endpoint"] == (
        "resend?redirect_to=http%3A%2F%2F127.0.0.1%3A5173%2Fauth%2Fcallback"
    )
    assert stub.calls[0]["payload"] == {
        "email": "citizen@example.com",
        "type": "signup",
        "code_challenge": "B" * 43,
        "code_challenge_method": "s256",
    }


def test_pkce_code_exchange_uses_supabase_pkce_grant():
    stub = StubAuthService()
    app.dependency_overrides.clear()
    try:
        with _client_with_stub(stub) as client:
            response = client.post(
                "/api/auth/exchange-code",
                json={"code": "one-time-auth-code", "code_verifier": "v" * 43},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert stub.calls[0]["endpoint"] == "token?grant_type=pkce"
    assert stub.calls[0]["payload"] == {
        "auth_code": "one-time-auth-code",
        "code_verifier": "v" * 43,
    }


def test_registration_rejects_unpaired_pkce_parameters():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={
                "email": "citizen@example.com",
                "password": "a-strong-password",
                "full_name": "Citizen Example",
                "code_challenge": "A" * 43,
            },
        )

    assert response.status_code == 422
