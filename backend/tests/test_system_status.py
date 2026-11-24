import asyncio
from uuid import uuid4

import httpx
import pytest

from app.core.config import Settings
from app.core.errors import SupabaseRequestError
from app.services.system_status import SupabaseSystemStatusService


def test_system_status_writer_requires_server_service_key():
    async def run():
        settings = Settings(
            _env_file=None,
            supabase_url="https://unit-test.invalid",
            supabase_anon_key="unit-test-anon",
            supabase_service_role_key=None,
        )
        async with httpx.AsyncClient() as client:
            writer = SupabaseSystemStatusService(settings, client)
            with pytest.raises(SupabaseRequestError) as error:
                await writer.set_document_status(uuid4(), "processing")
        assert error.value.status_code == 503

    asyncio.run(run())


def test_system_status_writer_rejects_unknown_status_without_network_access():
    async def run():
        settings = Settings(_env_file=None)
        async with httpx.AsyncClient() as client:
            writer = SupabaseSystemStatusService(settings, client)
            with pytest.raises(SupabaseRequestError) as error:
                await writer.set_application_status(uuid4(), "unrecognized")
        assert error.value.status_code == 422

    asyncio.run(run())
