from __future__ import annotations

import hashlib
import io
import os
import time
from dataclasses import dataclass

import pdfplumber
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import AzureOpenAI


@dataclass
class PipelineSettings:
    azure_openai_endpoint: str = os.environ["AZURE_OPENAI_ENDPOINT"]
    azure_openai_api_key: str = os.environ["AZURE_OPENAI_API_KEY"]
    azure_openai_api_version: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview")
    azure_openai_embedding_deployment: str = os.environ["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"]

    azure_search_endpoint: str = os.environ["AZURE_SEARCH_ENDPOINT"]
    azure_search_api_key: str = os.environ["AZURE_SEARCH_API_KEY"]
    azure_search_index_name: str = os.environ["AZURE_SEARCH_INDEX_NAME"]
    azure_search_vector_field: str = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "contentVector")
    azure_search_content_field: str = os.getenv("AZURE_SEARCH_CONTENT_FIELD", "content")
    azure_search_id_field: str = os.getenv("AZURE_SEARCH_ID_FIELD", "id")
    azure_search_source_field: str = os.getenv("AZURE_SEARCH_SOURCE_FIELD", "source_file")


class IngestionService:
    def __init__(self, settings: PipelineSettings) -> None:
        self.settings = settings
        self.openai_client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
        )
        self.search_client = SearchClient(
            endpoint=settings.azure_search_endpoint,
            index_name=settings.azure_search_index_name,
            credential=AzureKeyCredential(settings.azure_search_api_key),
        )
        self.splitter = RecursiveCharacterTextSplitter(
            # Slightly smaller chunks with higher overlap improve recall for eligibility/details
            # that span heading + bullet boundaries in policy PDFs.
            chunk_size=1400,
            chunk_overlap=250,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _retry(self, fn, *, attempts: int = 5, base_sleep_s: float = 0.7):
        last_exc = None
        for i in range(attempts):
            try:
                return fn()
            except Exception as exc:
                last_exc = exc
                time.sleep(base_sleep_s * (2**i))
        raise last_exc  # type: ignore[misc]

    def extract_pdf_text(self, file_content: bytes) -> str:
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            page_texts = [(page.extract_text() or "").strip() for page in pdf.pages]
        text = "\n".join(page_texts).strip()
        return text

    def chunk_text(self, text: str) -> list[str]:
        return [chunk.strip() for chunk in self.splitter.split_text(text) if chunk.strip()]

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        # Batch embeddings to reduce latency/cost and avoid per-call overhead.
        batch_size = int(os.getenv("EMBEDDING_BATCH_SIZE", "16"))
        embeddings: list[list[float]] = []

        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]

            def _call():
                return self.openai_client.embeddings.create(
                    model=self.settings.azure_openai_embedding_deployment,
                    input=batch,
                )

            response = self._retry(_call)
            # API returns embeddings in the same order as inputs.
            embeddings.extend([item.embedding for item in response.data])

        return embeddings

    def upsert_chunks(self, source_file: str, chunks: list[str], embeddings: list[list[float]]) -> None:
        batch_size = int(os.getenv("SEARCH_UPLOAD_BATCH_SIZE", "250"))
        documents: list[dict] = []

        for idx, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            chunk_hash = hashlib.sha1(f"{source_file}:{idx}:{chunk[:64]}".encode("utf-8")).hexdigest()
            documents.append(
                {
                    self.settings.azure_search_id_field: chunk_hash,
                    self.settings.azure_search_source_field: source_file,
                    self.settings.azure_search_content_field: chunk,
                    self.settings.azure_search_vector_field: vector,
                    "chunk_index": idx,
                }
            )

        for start in range(0, len(documents), batch_size):
            batch = documents[start : start + batch_size]

            def _upload():
                return self.search_client.upload_documents(documents=batch)

            self._retry(_upload)

    def process_pdf(self, source_file: str, file_content: bytes) -> int:
        extracted_text = self.extract_pdf_text(file_content=file_content)
        if not extracted_text:
            return 0

        chunks = self.chunk_text(extracted_text)
        if not chunks:
            return 0

        embeddings = self.embed_chunks(chunks=chunks)
        self.upsert_chunks(source_file=source_file, chunks=chunks, embeddings=embeddings)
        return len(chunks)
