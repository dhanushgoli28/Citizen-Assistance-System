from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.errors import SupabaseRequestError
from app.schemas.auth import AuthenticatedUser
from app.services.supabase import SupabaseService
from app.services.system_status import SupabaseSystemStatusService

bearer_scheme = HTTPBearer(auto_error=False)


def get_supabase_service(request: Request) -> SupabaseService:
    return SupabaseService(get_settings(), request.app.state.http_client)


def get_system_status_service(request: Request) -> SupabaseSystemStatusService:
    return SupabaseSystemStatusService(get_settings(), request.app.state.http_client)


async def require_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    service: Annotated[SupabaseService, Depends(get_supabase_service)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="A valid Supabase access token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        data = await service.request_auth(
            "GET",
            "user",
            access_token=credentials.credentials,
        )
        return AuthenticatedUser.model_validate(
            {**data, "access_token": credentials.credentials}
        )
    except SupabaseRequestError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None,
        ) from exc


CurrentUser = Annotated[AuthenticatedUser, Depends(require_user)]
CurrentService = Annotated[SupabaseService, Depends(get_supabase_service)]
CurrentSystemStatus = Annotated[
    SupabaseSystemStatusService,
    Depends(get_system_status_service),
]
