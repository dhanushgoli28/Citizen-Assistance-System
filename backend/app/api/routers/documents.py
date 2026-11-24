import asyncio
import io
import logging
import re
from urllib.parse import quote, urlencode
from uuid import UUID, uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.api.dependencies import CurrentService, CurrentSystemStatus, CurrentUser
from app.core.errors import SupabaseRequestError
from app.schemas.documents import DocumentExtractionResponse, DocumentResponse
from app.services.activity import create_notification, record_activity

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger("cas.documents")
BUCKET = "citizen-documents"
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_OCR_PAGES = 5
MAX_IMAGE_PIXELS = 30_000_000
MAX_EXTRACTED_CHARACTERS = 50_000
DOCUMENT_FIELDS = (
    "id,original_filename,mime_type,file_size_bytes,document_type,status,created_at,updated_at"
)


def _database_error(exc: SupabaseRequestError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


def _validate_upload(filename: str, content: bytes) -> str:
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    signatures = {
        "pdf": (b"%PDF-", "application/pdf"),
        "jpg": (b"\xff\xd8\xff", "image/jpeg"),
        "jpeg": (b"\xff\xd8\xff", "image/jpeg"),
        "png": (b"\x89PNG\r\n\x1a\n", "image/png"),
    }
    detected = signatures.get(extension)
    if not detected or not content.startswith(detected[0]):
        raise HTTPException(
            status_code=415,
            detail="Upload a valid PDF, JPG, or PNG file with a matching file extension.",
        )
    return detected[1]


def _safe_filename(filename: str) -> str:
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name).strip("._")
    if not name:
        raise HTTPException(status_code=422, detail="The uploaded filename is invalid.")
    return name[:255]


def _classify_document(text: str) -> tuple[str | None, list[str]]:
    lowered = text.casefold()
    patterns = (
        ("aadhaar", ("aadhaar", "uidai")),
        ("income_certificate", ("income certificate", "annual income")),
        ("ration_card", ("ration card", "public distribution system")),
        ("bank_statement", ("bank statement", "account statement")),
        ("marksheet", ("marksheet", "mark sheet", "board examination")),
    )
    for kind, terms in patterns:
        if any(term in lowered for term in terms):
            missing = []
            if kind == "aadhaar" and not re.search(r"date of birth|dob", lowered):
                missing.append("Date of birth text was not detected.")
            if kind == "income_certificate" and not re.search(
                r"(?:₹|rs\.?|inr)\s*[\d,]+|\b\d[\d,]*\s*(?:per annum|annually|annual)",
                lowered,
            ):
                missing.append("An annual-income amount was not detected.")
            return kind, missing
    return None, ["The document type could not be classified from extracted text."]


def _extract_document_text(content: bytes, mime_type: str) -> tuple[str, str]:
    try:
        import fitz
        from PIL import Image
        import pytesseract
    except ImportError as exc:
        raise RuntimeError("Document processing libraries are not installed.") from exc

    text = ""
    method = "text"
    if mime_type == "application/pdf":
        with fitz.open(stream=content, filetype="pdf") as document:
            if document.page_count > MAX_PDF_PAGES:
                raise ValueError(f"PDFs are limited to {MAX_PDF_PAGES} pages.")
            text = "\n".join(page.get_text() for page in document)
            if not text.strip():
                if document.page_count > MAX_OCR_PAGES:
                    raise ValueError(
                        f"Scanned PDFs are limited to {MAX_OCR_PAGES} pages for OCR."
                    )
                method = "ocr"
                pages = []
                for page in document:
                    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                    image = Image.frombytes(
                        "RGB",
                        (pixmap.width, pixmap.height),
                        pixmap.samples,
                    )
                    pages.append(pytesseract.image_to_string(image, timeout=20))
                text = "\n".join(pages)
    else:
        method = "ocr"
        with Image.open(io.BytesIO(content)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ValueError("The image resolution exceeds the processing limit.")
            text = pytesseract.image_to_string(image, timeout=20)

    text = text.strip()
    if not text:
        raise ValueError("No readable text was extracted from this document.")
    return text[:MAX_EXTRACTED_CHARACTERS], method


async def _storage_request(
    service,
    method: str,
    endpoint: str,
    access_token: str,
    *,
    content: bytes | None = None,
    content_type: str | None = None,
    payload: dict | None = None,
):
    return await service.request_storage(
        method,
        endpoint,
        access_token=access_token,
        content=content,
        content_type=content_type,
        payload=payload,
    )


@router.get("", response_model=list[DocumentResponse])
async def list_documents(user: CurrentUser, service: CurrentService):
    try:
        return await service.request_rest(
            "GET",
            f"documents?{urlencode({'select': DOCUMENT_FIELDS, 'order': 'created_at.desc'})}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    user: CurrentUser,
    service: CurrentService,
    file: UploadFile = File(...),
):
    filename = _safe_filename(file.filename or "")
    content = await file.read(MAX_FILE_SIZE + 1)
    if not content or len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Files must be between 1 byte and 10 MiB.")
    mime_type = _validate_upload(filename, content)
    object_path = f"{user.id}/{uuid4()}/{filename}"
    storage_path = f"object/{BUCKET}/{quote(object_path, safe='/')}"
    try:
        await _storage_request(
            service,
            "POST",
            storage_path,
            user.access_token,
            content=content,
            content_type=mime_type,
        )
        rows = await service.request_rest(
            "POST",
            "documents",
            access_token=user.access_token,
            payload={
                "user_id": str(user.id),
                "object_path": object_path,
                "original_filename": filename,
                "mime_type": mime_type,
                "file_size_bytes": len(content),
            },
            prefer="return=representation",
        )
    except SupabaseRequestError as exc:
        try:
            await _storage_request(
                service,
                "DELETE",
                f"object/{BUCKET}",
                user.access_token,
                payload={"prefixes": [object_path]},
            )
        except SupabaseRequestError:
            logger.exception("Could not clean up storage after a failed document upload.")
        raise _database_error(exc) from exc

    if not rows:
        raise HTTPException(status_code=502, detail="Supabase did not return the uploaded document.")
    await record_activity(service, user, "document.uploaded", "Uploaded a private document.")
    return rows[0]


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "GET",
            f"documents?id=eq.{document_id}&select={DOCUMENT_FIELDS}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="Document not found.")
    return rows[0]


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "GET",
            f"documents?id=eq.{document_id}&select=object_path,original_filename,mime_type",
            access_token=user.access_token,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Document not found.")
        document = rows[0]
        content = await _storage_request(
            service,
            "GET",
            f"object/authenticated/{BUCKET}/{quote(document['object_path'], safe='/')}",
            user.access_token,
        )
    except HTTPException:
        raise
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc

    filename = re.sub(r"[^A-Za-z0-9._-]", "_", document["original_filename"])
    return StreamingResponse(
        io.BytesIO(content),
        media_type=document["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{document_id}/extraction", response_model=DocumentExtractionResponse)
async def get_document_extraction(
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "GET",
            f"document_extractions?{urlencode({'document_id': f'eq.{document_id}', 'select': '*'})}",
            access_token=user.access_token,
        )
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    if not rows:
        raise HTTPException(status_code=404, detail="No extraction is available for this document.")
    return rows[0]


@router.post("/{document_id}/analyze", response_model=DocumentExtractionResponse)
async def analyze_document(
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
    system_status: CurrentSystemStatus,
):
    try:
        documents = await service.request_rest(
            "GET",
            f"documents?id=eq.{document_id}&select=id,object_path,mime_type,document_type",
            access_token=user.access_token,
        )
        if not documents:
            raise HTTPException(status_code=404, detail="Document not found.")
        document = documents[0]
        await system_status.set_document_status(document_id, "processing")
        object_path = quote(document["object_path"], safe="/")
        content = await _storage_request(
            service,
            "GET",
            f"object/authenticated/{BUCKET}/{object_path}",
            user.access_token,
        )
        text, method = await asyncio.to_thread(
            _extract_document_text,
            content,
            document["mime_type"],
        )
        document_type, missing = _classify_document(text)
        extraction_payload = {
            "document_id": str(document_id),
            "extracted_data": {"character_count": len(text)},
            "summary": (
                f"Extracted {len(text)} characters using {method} processing. "
                "Review the original document; extracted text is not stored."
            ),
            "missing_information": missing,
            "processing_method": method,
        }
        existing = await service.request_rest(
            "GET",
            f"document_extractions?{urlencode({'document_id': f'eq.{document_id}', 'select': 'document_id'})}",
            access_token=user.access_token,
        )
        if existing:
            result = await service.request_rest(
                "PATCH",
                f"document_extractions?{urlencode({'document_id': f'eq.{document_id}'})}",
                access_token=user.access_token,
                payload={key: value for key, value in extraction_payload.items() if key != "document_id"},
                prefer="return=representation",
            )
        else:
            result = await service.request_rest(
                "POST",
                "document_extractions",
                access_token=user.access_token,
                payload=extraction_payload,
                prefer="return=representation",
            )
        if document_type:
            await service.request_rest(
                "PATCH",
                f"documents?id=eq.{document_id}",
                access_token=user.access_token,
                payload={"document_type": document_type},
            )
        await system_status.set_document_status(document_id, "processed")
    except HTTPException:
        raise
    except SupabaseRequestError as exc:
        try:
            await system_status.set_document_status(document_id, "failed")
        except SupabaseRequestError:
            logger.exception("Could not mark document processing failure.")
        raise _database_error(exc) from exc
    except (OSError, RuntimeError, ValueError) as exc:
        try:
            await system_status.set_document_status(document_id, "failed")
        except SupabaseRequestError:
            logger.exception("Could not mark document processing failure.")
        status = 503 if isinstance(exc, RuntimeError) else 422
        message = (
            "Document processing is unavailable. Install the required OCR/document tools."
            if status == 503
            else str(exc)
        )
        raise HTTPException(status_code=status, detail=message) from exc

    if not result:
        raise HTTPException(status_code=502, detail="Supabase did not return the extraction.")
    await record_activity(service, user, "document.processed", "Processed a private document.")
    await create_notification(
        service,
        user,
        "Document processing complete",
        "A document extraction is ready for your review.",
    )
    return {
        **result[0],
        "document_type": document_type,
        "extracted_text": text,
    }


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    user: CurrentUser,
    service: CurrentService,
):
    try:
        rows = await service.request_rest(
            "GET",
            f"documents?id=eq.{document_id}&select=object_path",
            access_token=user.access_token,
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Document not found.")
        object_path = rows[0]["object_path"]
        await _storage_request(
            service,
            "DELETE",
            f"object/{BUCKET}",
            user.access_token,
            payload={"prefixes": [object_path]},
        )
        await service.request_rest(
            "DELETE",
            f"documents?id=eq.{document_id}",
            access_token=user.access_token,
        )
    except HTTPException:
        raise
    except SupabaseRequestError as exc:
        raise _database_error(exc) from exc
    await record_activity(service, user, "document.deleted", "Deleted a private document.")
