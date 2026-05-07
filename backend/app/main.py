import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .rag_service import RAGService
from .schemas import AskRequest, AskResponse, CreateUploadUrlRequest, CreateUploadUrlResponse
from .upload_service import UploadService

logger = logging.getLogger("gram_sahayak.backend")

settings = get_settings()
rag_service = RAGService(settings)
try:
    upload_service = UploadService(settings) if settings.blob_storage_connection_string else None
except Exception as exc:
    # Don't prevent the API from starting; only uploads will be unavailable.
    logger.warning("upload_disabled: %s", str(exc))
    upload_service = None

app = FastAPI(
    title="Gram Sahayak RAG API",
    version="1.0.0",
    description="Backend API for contextual welfare-scheme Q&A with multilingual responses.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=settings.allow_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/ask", response_model=AskResponse)
def ask_question(payload: AskRequest, request: Request) -> AskResponse:
    try:
        client_host = request.client.host if request.client else "unknown"
        logger.info("ask_request", extra={"client": client_host, "language": payload.language})
        answer, sources = rag_service.answer(query=payload.query, language=payload.language)
        return AskResponse(answer=answer, sources=sources)
    except Exception as exc:
        logger.exception("ask_failed", extra={"error": str(exc)})
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(exc)}") from exc


@app.post("/api/upload-url", response_model=CreateUploadUrlResponse)
def create_upload_url(payload: CreateUploadUrlRequest) -> CreateUploadUrlResponse:
    if upload_service is None:
        raise HTTPException(status_code=500, detail="Upload is not configured on the backend.")
    try:
        result = upload_service.create_upload_url(filename=payload.filename)
        return CreateUploadUrlResponse(
            upload_url=result.upload_url,
            blob_name=result.blob_name,
            expires_in_seconds=result.expires_in_seconds,
        )
    except Exception as exc:
        logger.exception("upload_url_failed", extra={"error": str(exc)})
        raise HTTPException(status_code=500, detail=f"Failed to create upload URL: {str(exc)}") from exc
