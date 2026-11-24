from fastapi import Request
from fastapi.testclient import TestClient

from app.api.dependencies import get_supabase_service
from app.core.config import Settings
from app.main import app
from app.services.supabase import SupabaseService


def test_health_reports_service_and_configuration_state():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "cas-api"
    assert "supabase_configured" in response.json()


def test_readiness_requires_production_configuration(monkeypatch):
    monkeypatch.setattr(
        "app.main.settings",
        Settings(
            _env_file=None,
            environment="production",
            cors_origins=["http://localhost:5173"],
        ),
    )
    with TestClient(app) as client:
        response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "Required production services are not configured."


def test_auth_rejects_bad_registration_before_calling_supabase():
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "short", "full_name": "A"},
        )

    assert response.status_code == 422


def test_authenticated_routes_require_a_bearer_token():
    with TestClient(app) as client:
        response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_legal_chat_requires_a_bearer_token():
    with TestClient(app) as client:
        response = client.post(
            "/api/legal/chat",
            json={"message": "Where can I find official legal information?"},
        )

    assert response.status_code == 401


def test_registration_reports_missing_supabase_configuration():
    def unconfigured_service(request: Request):
        return SupabaseService(
            Settings(_env_file=None, supabase_url=None, supabase_anon_key=None),
            request.app.state.http_client,
        )

    app.dependency_overrides[get_supabase_service] = unconfigured_service
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/auth/register",
                json={
                    "email": "citizen@example.com",
                    "password": "a-strong-password",
                    "full_name": "Citizen Example",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["detail"] == "Supabase is not configured on the server."


def test_openapi_lists_the_phase_one_api_routes():
    paths = app.openapi()["paths"]

    assert "/health" in paths
    assert "/api/auth/register" in paths
    assert "/api/auth/login" in paths
    assert "/api/auth/verify" in paths
    assert "/api/auth/exchange-code" in paths
    assert "/api/users/profile" in paths
    assert "/api/legal/chat" in paths
