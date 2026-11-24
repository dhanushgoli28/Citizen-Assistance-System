import re
from datetime import date
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app.api.dependencies import CurrentService, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.schemes import (
    EligibilityResponse,
    EligibilityRuleResult,
    SchemeResponse,
)

router = APIRouter(prefix="/schemes", tags=["schemes"])
SCHEME_FIELDS = (
    "id,slug,name,summary,jurisdiction,state,category,official_source_url,"
    "application_url,verified_at"
)
RULE_FIELDS = "criterion,operator,expected_value,explanation"
SAFE_FILTER = re.compile(r"^[A-Za-z0-9 _-]{1,80}$")
SUPPORTED_CRITERIA = {
    "age",
    "annual_income",
    "occupation",
    "state",
    "district",
    "family_size",
    "household_income",
}


def _database_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _age(date_of_birth: str | date | None) -> int | None:
    if not date_of_birth:
        return None
    try:
        birth = date.fromisoformat(str(date_of_birth))
    except ValueError:
        return None
    today = date.today()
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def _profile_value(criterion: str, profile: dict, family: list[dict]):
    if criterion == "age":
        return _age(profile.get("date_of_birth"))
    if criterion == "family_size":
        return len(family) + 1
    if criterion == "household_income":
        values = [profile.get("annual_income"), *(member.get("annual_income") for member in family)]
        if any(value is None for value in values):
            return None
        try:
            return sum((Decimal(str(value)) for value in values), Decimal(0))
        except InvalidOperation:
            return None
    return profile.get(criterion)


def _compare(actual, operator: str, expected) -> bool:
    if operator in {"in", "not_in"}:
        if not isinstance(expected, list):
            raise ValueError("Membership rules must use an array.")
        values = [str(value).casefold() for value in expected]
        found = str(actual).casefold() in values
        return found if operator == "in" else not found

    if operator not in {"eq", "neq", "gt", "gte", "lt", "lte"}:
        raise ValueError("Unsupported comparison operator.")
    if operator in {"eq", "neq"}:
        equal = str(actual).casefold() == str(expected).casefold()
        return equal if operator == "eq" else not equal

    try:
        left, right = Decimal(str(actual)), Decimal(str(expected))
    except InvalidOperation as exc:
        raise ValueError("Ordered comparisons require numeric values.") from exc
    return {
        "gt": left > right,
        "gte": left >= right,
        "lt": left < right,
        "lte": left <= right,
    }[operator]


@router.get("", response_model=list[SchemeResponse])
async def list_schemes(
    user: CurrentUser,
    service: CurrentService,
    search: str | None = Query(default=None, max_length=100),
    category: str | None = Query(default=None, max_length=80),
    jurisdiction: str | None = Query(default=None, pattern=r"^(central|state)$"),
    state: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=100, ge=1, le=200),
):
    params = {
        "select": SCHEME_FIELDS,
        "is_published": "eq.true",
        "order": "name.asc",
        "limit": str(limit),
    }
    for key, value in (("category", category), ("state", state), ("jurisdiction", jurisdiction)):
        if value is not None:
            if not SAFE_FILTER.fullmatch(value):
                raise HTTPException(status_code=422, detail=f"Invalid {key} filter.")
            params[key] = f"eq.{value}"

    try:
        schemes = await service.request_rest(
            "GET",
            f"schemes?{urlencode(params)}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc

    if search:
        term = search.casefold()
        schemes = [
            scheme for scheme in schemes
            if term in scheme["name"].casefold() or term in scheme["summary"].casefold()
        ]
    return schemes


@router.post("/{scheme_id}/eligibility", response_model=EligibilityResponse)
async def check_eligibility(
    scheme_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    user_id = str(user.id)
    try:
        scheme_rows = await service.request_rest(
            "GET",
            f"schemes?id=eq.{scheme_id}&is_published=eq.true&select={SCHEME_FIELDS}",
            access_token=user.access_token,
        )
        if not scheme_rows:
            raise HTTPException(status_code=404, detail="Published scheme not found.")
        scheme = scheme_rows[0]
        profile_rows = await service.request_rest(
            "GET",
            f"profiles?id=eq.{user_id}&select=*",
            access_token=user.access_token,
        )
        rules = await service.request_rest(
            "GET",
            f"scheme_eligibility_rules?{urlencode({'scheme_id': f'eq.{scheme_id}', 'select': RULE_FIELDS})}",
            access_token=user.access_token,
        )
        family = await service.request_rest(
            "GET",
            f"family_members?{urlencode({'user_id': f'eq.{user_id}', 'select': 'date_of_birth,occupation,annual_income'})}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc

    if not rules:
        return EligibilityResponse(
            scheme_id=scheme_id,
            status="no_rules",
            is_eligible=None,
            rules=[],
            missing_information=["No verified eligibility rules are available for this scheme."],
            official_source_url=scheme["official_source_url"],
            verified_at=scheme["verified_at"],
        )

    profile = profile_rows[0] if profile_rows else {}
    results = []
    missing = []
    failed = False
    for rule in rules:
        criterion = rule["criterion"]
        explanation = rule["explanation"]
        if criterion not in SUPPORTED_CRITERIA:
            results.append(EligibilityRuleResult(
                criterion=criterion,
                status="unsupported",
                explanation=f"{explanation} The system cannot evaluate this criterion automatically.",
                expected_value=rule["expected_value"],
            ))
            missing.append(criterion)
            continue
        actual = _profile_value(criterion, profile, family)
        if actual is None:
            results.append(EligibilityRuleResult(
                criterion=criterion,
                status="missing",
                explanation=explanation,
                expected_value=rule["expected_value"],
            ))
            missing.append(criterion)
            continue
        try:
            passed = _compare(actual, rule["operator"], rule["expected_value"])
        except ValueError:
            results.append(EligibilityRuleResult(
                criterion=criterion,
                status="unsupported",
                explanation=f"{explanation} The saved rule is not supported by the eligibility evaluator.",
                actual_value=str(actual),
                expected_value=rule["expected_value"],
            ))
            missing.append(criterion)
            continue
        failed = failed or not passed
        results.append(EligibilityRuleResult(
            criterion=criterion,
            status="pass" if passed else "fail",
            explanation=explanation,
            actual_value=str(actual) if isinstance(actual, Decimal) else actual,
            expected_value=rule["expected_value"],
        ))

    status = "ineligible" if failed else (
        "needs_information" if missing else "eligible"
    )
    return EligibilityResponse(
        scheme_id=scheme_id,
        status=status,
        is_eligible=False if failed else (None if missing else True),
        rules=results,
        missing_information=missing,
        official_source_url=scheme["official_source_url"],
        verified_at=scheme["verified_at"],
    )
