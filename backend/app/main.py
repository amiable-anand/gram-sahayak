import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .rag_service import RAGService
from .schemas import AskRequest, AskResponse

settings = get_settings()
rag_service = RAGService(settings)

app = FastAPI(
    title="Gram Sahayak RAG API",
    version="1.0.0",
    description="Backend API for contextual welfare-scheme Q&A with multilingual responses.",
)

logger = logging.getLogger("gram_sahayak.backend")

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
