import fitz
import pytest
from fastapi.testclient import TestClient

from app.api.routers.documents import (
    _classify_document,
    _extract_document_text,
    _validate_upload,
)
from app.api.routers.schemes import _compare
from app.main import app
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationUpdate,
    ExternalSubmissionConfirmation,
)


def test_core_private_api_routes_require_a_bearer_token():
    protected_paths = [
        ("/api/dashboard", "GET"),
        ("/api/users/family", "GET"),
        ("/api/schemes", "GET"),
        ("/api/documents", "GET"),
        ("/api/applications", "GET"),
        ("/api/notifications", "GET"),
        ("/api/legal/conversations", "GET"),
        ("/api/legal/chat", "POST"),
    ]
    with TestClient(app) as client:
        for path, method in protected_paths:
            response = client.request(method, path)
            assert response.status_code == 401, path


def test_document_upload_validation_checks_file_signature():
    assert _validate_upload("scan.pdf", b"%PDF-1.7 data") == "application/pdf"
    assert _validate_upload("photo.png", b"\x89PNG\r\n\x1a\nimage") == "image/png"
    with pytest.raises(Exception):
        _validate_upload("scan.pdf", b"not a PDF")
    with pytest.raises(Exception):
        _validate_upload("image.svg", b"<svg/>")


def test_pdf_text_extraction_uses_real_pdf_text_without_storing_it():
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Official document text")
    content = pdf.tobytes()
    pdf.close()

    extracted, method = _extract_document_text(content, "application/pdf")

    assert extracted == "Official document text"
    assert method == "text"


def test_document_classification_reports_uncertainty_and_detected_missing_fields():
    kind, missing = _classify_document("UIDAI Aadhaar information")

    assert kind == "aadhaar"
    assert missing == ["Date of birth text was not detected."]
    assert _classify_document("unrelated words")[0] is None


def test_rule_engine_comparison_is_transparent_and_rejects_malformed_rules():
    assert _compare(18, "gte", 18)
    assert not _compare(17, "gte", 18)
    assert _compare("Tamil Nadu", "in", ["Tamil Nadu", "Kerala"])
    with pytest.raises(ValueError):
        _compare(1, "contains", [1])


@pytest.mark.parametrize(
    "schema,payload",
    [
        (ApplicationCreate, {"application_type": "Draft", "status": "completed"}),
        (ApplicationUpdate, {"status": "completed"}),
        (ApplicationUpdate, {"form_data": None}),
        (ApplicationUpdate, {"application_type": None}),
    ],
)
def test_application_requests_reject_status_and_invalid_null_fields(schema, payload):
    with pytest.raises(ValueError):
        schema.model_validate(payload)


def test_external_submission_status_requires_explicit_true_confirmation():
    with pytest.raises(ValueError):
        ExternalSubmissionConfirmation.model_validate(
            {"confirmed_external_submission": False}
        )
