from contextlib import asynccontextmanager
import logging
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.routers import (
    applications,
    auth,
    dashboard,
    documents,
    family,
    forms,
    legal,
    notifications,
    schemes,
    users,
)
from app.core.config import get_settings
from app.core.limiter import limiter

settings = get_settings()
logger = logging.getLogger("cas.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=httpx.Timeout(15.0))
    try:
        yield
    finally:
        await app.state.http_client.aclose()


app = FastAPI(
    title=settings.app_name,
    description="Citizen Assistance System API foundation.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth.router, prefix="/api")
app.include_router(applications.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(family.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(legal.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(schemes.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "service": "cas-api",
        "supabase_configured": settings.supabase_configured,
    }


@app.get("/health/ready", tags=["health"])
async def readiness() -> dict[str, str]:
    configured = (
        settings.supabase_configured
        and settings.supabase_service_role_key is not None
        and settings.gemini_api_key is not None
    )
    public_origin_configured = any(
        urlsplit(origin).hostname not in {None, "localhost", "127.0.0.1", "::1"}
        for origin in settings.cors_origins
    )
    if settings.environment == "production":
        configured = configured and public_origin_configured
    if not configured:
        raise HTTPException(status_code=503, detail="Required production services are not configured.")
    return {"status": "ready", "service": "cas-api"}


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error for %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."},
    )
