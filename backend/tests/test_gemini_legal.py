import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import Settings
from app.schemas.legal import LegalChatRequest
from app.services.gemini_legal import (
    LEGAL_DISCLAIMER,
    UNGROUNDED_ANSWER,
    GeminiLegalError,
    GeminiLegalService,
)


def _settings(api_key="unit-test-key"):
    secret = SecretStr(api_key) if api_key else None
    return Settings(_env_file=None, gemini_api_key=secret)


def _grounded_payload(
    text="Use the official portal to find current information.",
    url="https://example.gov.in/legal-guidance",
):
    return {
        "candidates": [
            {
                "content": {"parts": [{"text": text}]},
                "groundingMetadata": {
                    "groundingChunks": [
                        {"web": {"uri": url, "title": "Official guidance"}}
                    ]
                },
            }
        ]
    }


def test_gemini_request_uses_backend_header_and_google_search_grounding():
    async def run():
        def handler(request):
            assert request.headers["x-goog-api-key"] == "unit-test-key"
            body = json.loads(request.content)
            assert body["tools"] == [{"google_search": {}}]
            assert "not personal legal advice" in body["systemInstruction"]["parts"][0]["text"]
            return httpx.Response(200, json=_grounded_payload())

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = GeminiLegalService(_settings(), client)
            result = await service.answer(
                LegalChatRequest(
                    message="Where can I find current information?",
                    category="general",
                )
            )

        assert result.grounded is True
        assert result.answer == "Use the official portal to find current information."
        assert str(result.sources[0].url) == "https://example.gov.in/legal-guidance"
        assert result.disclaimer == LEGAL_DISCLAIMER

    asyncio.run(run())


def test_gemini_response_without_official_grounding_is_not_presented_as_guidance():
    async def run():
        handler = lambda request: httpx.Response(
            200,
            json=_grounded_payload(url="https://example.com/legal-guidance"),
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = GeminiLegalService(_settings(), client)
            result = await service.answer(LegalChatRequest(message="Explain a process."))

        assert result.grounded is False
        assert result.answer == UNGROUNDED_ANSWER
        assert result.sources == []

    asyncio.run(run())


def test_gemini_response_with_specific_legal_citation_fails_closed():
    async def run():
        handler = lambda request: httpx.Response(
            200,
            json=_grounded_payload(text="Section 123 provides the answer."),
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = GeminiLegalService(_settings(), client)
            result = await service.answer(LegalChatRequest(message="What law applies?"))

        assert result.grounded is False
        assert result.answer == UNGROUNDED_ANSWER
        assert result.sources == []

    asyncio.run(run())


def test_missing_api_key_fails_before_network_request():
    async def run():
        def unexpected_request(request):
            raise AssertionError("Gemini must not be called without a configured key.")

        async with httpx.AsyncClient(transport=httpx.MockTransport(unexpected_request)) as client:
            service = GeminiLegalService(_settings(api_key=None), client)
            with pytest.raises(GeminiLegalError) as error:
                await service.answer(LegalChatRequest(message="A question"))

        assert error.value.status_code == 503

    asyncio.run(run())


def test_provider_rate_limit_is_returned_as_a_safe_temporary_error():
    async def run():
        handler = lambda request: httpx.Response(429, json={"error": "details omitted"})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = GeminiLegalService(_settings(), client)
            with pytest.raises(GeminiLegalError) as error:
                await service.answer(LegalChatRequest(message="A question"))

        assert error.value.status_code == 503
        assert "temporarily at capacity" in error.value.message

    asyncio.run(run())


def test_legal_chat_validates_blank_messages_and_context_size():
    with pytest.raises(ValidationError):
        LegalChatRequest(message="   ")

    with pytest.raises(ValidationError):
        LegalChatRequest(
            message="Question",
            history=[
                {"role": "user", "content": "x" * 2000},
                {"role": "assistant", "content": "y" * 2000},
                {"role": "user", "content": "z" * 2000},
                {"role": "assistant", "content": "w" * 2000},
                {"role": "user", "content": "x"},
            ],
        )
