from fastapi import APIRouter, HTTPException, Request
from urllib.parse import urlencode

from app.api.dependencies import CurrentService, CurrentUser
from app.core.config import get_settings
from app.core.errors import SupabaseRequestError
from app.core.limiter import limiter
from app.schemas.auth import (
    AuthCodeExchangeRequest,
    AuthSessionResponse,
    EmailResendRequest,
    EmailVerificationRequest,
    LoginRequest,
    PasswordResetRequest,
    PasswordUpdateRequest,
    RefreshRequest,
    RegisterRequest,
    SupabaseUser,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


def _supabase_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


@router.post("/register", response_model=AuthSessionResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    service: CurrentService,
) -> AuthSessionResponse:
    settings = get_settings()
    signup_endpoint = "signup?" + urlencode(
        {"redirect_to": str(settings.auth_email_redirect_url)}
    )
    signup_payload = {
        "email": str(payload.email),
        "password": payload.password,
        "data": {"full_name": payload.full_name.strip()},
    }
    if payload.code_challenge:
        signup_payload["code_challenge"] = payload.code_challenge
        signup_payload["code_challenge_method"] = payload.code_challenge_method

    try:
        result = await service.request_auth(
            "POST",
            signup_endpoint,
            payload=signup_payload,
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    if result.get("user") and not result.get("access_token"):
        result["message"] = "Account created. Check your email to verify your address before signing in."
    return AuthSessionResponse.model_validate(result)


@router.post("/verify", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
async def verify_email(
    request: Request,
    payload: EmailVerificationRequest,
    service: CurrentService,
) -> AuthSessionResponse:
    try:
        result = await service.request_auth(
            "POST",
            "verify",
            payload={"token_hash": payload.token_hash, "type": payload.type},
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return AuthSessionResponse.model_validate(result)


@router.post("/exchange-code", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
async def exchange_auth_code(
    request: Request,
    payload: AuthCodeExchangeRequest,
    service: CurrentService,
) -> AuthSessionResponse:
    try:
        result = await service.request_auth(
            "POST",
            "token?grant_type=pkce",
            payload={
                "auth_code": payload.code,
                "code_verifier": payload.code_verifier,
            },
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return AuthSessionResponse.model_validate(result)


@router.post("/login", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    service: CurrentService,
) -> AuthSessionResponse:
    try:
        result = await service.request_auth(
            "POST",
            "token?grant_type=password",
            payload={"email": str(payload.email), "password": payload.password},
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return AuthSessionResponse.model_validate(result)


@router.post("/refresh", response_model=AuthSessionResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    payload: RefreshRequest,
    service: CurrentService,
) -> AuthSessionResponse:
    try:
        result = await service.request_auth(
            "POST",
            "token?grant_type=refresh_token",
            payload={"refresh_token": payload.refresh_token},
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return AuthSessionResponse.model_validate(result)


@router.post("/password-reset")
@limiter.limit("5/minute")
async def password_reset(
    request: Request,
    payload: PasswordResetRequest,
    service: CurrentService,
) -> dict[str, str]:
    settings = get_settings()
    endpoint = "recover?" + urlencode(
        {"redirect_to": str(settings.auth_email_redirect_url)}
    )
    reset_payload = {"email": str(payload.email)}
    if payload.code_challenge:
        reset_payload["code_challenge"] = payload.code_challenge
        reset_payload["code_challenge_method"] = payload.code_challenge_method
    try:
        await service.request_auth(
            "POST",
            endpoint,
            payload=reset_payload,
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return {"message": "If an account exists for this email, password reset instructions will be sent."}


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    payload: EmailResendRequest,
    service: CurrentService,
) -> dict[str, str]:
    settings = get_settings()
    endpoint = "resend?" + urlencode(
        {"redirect_to": str(settings.auth_email_redirect_url)}
    )
    resend_payload = {"email": str(payload.email), "type": payload.type}
    if payload.code_challenge:
        resend_payload["code_challenge"] = payload.code_challenge
        resend_payload["code_challenge_method"] = payload.code_challenge_method
    try:
        await service.request_auth("POST", endpoint, payload=resend_payload)
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return {"message": "If the account is awaiting verification, a new email will be sent."}


@router.put("/password")
@limiter.limit("5/minute")
async def update_password(
    request: Request,
    payload: PasswordUpdateRequest,
    user: CurrentUser,
    service: CurrentService,
) -> dict[str, str]:
    try:
        await service.request_auth(
            "PUT",
            "user",
            payload={"password": payload.password},
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return {"message": "Password updated."}


@router.post("/logout")
async def logout(
    user: CurrentUser,
    service: CurrentService,
) -> dict[str, str]:
    try:
        await service.request_auth("POST", "logout", access_token=user.access_token)
    except SupabaseRequestError as exc:
        raise _supabase_error(exc) from exc
    return {"message": "Signed out."}


@router.get("/me", response_model=SupabaseUser)
async def get_me(user: CurrentUser) -> SupabaseUser:
    return SupabaseUser(
        id=str(user.id),
        email=user.email,
        user_metadata=user.user_metadata,
    )
