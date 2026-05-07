from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from azure.storage.blob import BlobSasPermissions, generate_blob_sas

from .config import Settings


@dataclass(frozen=True)
class UploadUrlResult:
    upload_url: str
    blob_name: str
    expires_in_seconds: int


_FILENAME_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


def _parse_storage_connection_string(conn: str) -> dict[str, str]:
    # Expected format: Key=Value;Key=Value;...
    parts: dict[str, str] = {}
    for chunk in conn.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "=" not in chunk:
            continue
        k, v = chunk.split("=", 1)
        parts[k.strip()] = v.strip()
    return parts


def _sanitize_filename(name: str) -> str:
    name = name.strip().replace("\\", "/").split("/")[-1]
    name = _FILENAME_SAFE.sub("_", name)
    name = name.strip("._")
    if not name:
        return "document.pdf"
    if not name.lower().endswith(".pdf"):
        name = f"{name}.pdf"
    return name[:120]


class UploadService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

        if not settings.blob_storage_connection_string:
            raise RuntimeError("Missing BLOB_STORAGE_CONNECTION_STRING (blob_storage_connection_string).")

        parts = _parse_storage_connection_string(settings.blob_storage_connection_string)
        self.endpoint_suffix = parts.get("EndpointSuffix", "core.windows.net")

        # Two supported formats:
        # 1) Account key connection string (recommended):
        #    AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
        # 2) SAS connection string (works, but SAS scope is controlled outside the app):
        #    BlobEndpoint=https://<acct>.blob.core.windows.net/;SharedAccessSignature=sv=...
        self.account_name = parts.get("AccountName")
        self.account_key = parts.get("AccountKey")
        self.blob_endpoint = parts.get("BlobEndpoint")
        self.shared_access_signature = parts.get("SharedAccessSignature")

    def create_upload_url(self, filename: str, *, expires_in_minutes: int = 15) -> UploadUrlResult:
        safe = _sanitize_filename(filename)
        # Put blobs at container root so the Azure Function blob trigger pattern `incoming/{name}`
        # reliably fires even if binding pattern doesn't match virtual folders.
        blob_name = f"{uuid.uuid4().hex}-{safe}"

        # Preferred: generate a short-lived SAS per upload using AccountKey.
        if self.account_name and self.account_key:
            expiry = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

            sas = generate_blob_sas(
                account_name=self.account_name,
                account_key=self.account_key,
                container_name=self.settings.blob_container_name,
                blob_name=blob_name,
                permission=BlobSasPermissions(create=True, write=True),
                expiry=expiry,
                content_type="application/pdf",
            )

            upload_url = (
                f"https://{self.account_name}.blob.{self.endpoint_suffix}/"
                f"{self.settings.blob_container_name}/{blob_name}?{sas}"
            )

            return UploadUrlResult(upload_url=upload_url, blob_name=blob_name, expires_in_seconds=expires_in_minutes * 60)

        # Fallback: if user provided a SAS connection string, reuse it for uploads.
        # This is less ideal than per-blob SAS, but avoids crashing and still enables uploads.
        if self.blob_endpoint and self.shared_access_signature:
            sas = self.shared_access_signature.lstrip("?")
            base = self.blob_endpoint.rstrip("/")
            upload_url = f"{base}/{self.settings.blob_container_name}/{blob_name}?{sas}"
            return UploadUrlResult(upload_url=upload_url, blob_name=blob_name, expires_in_seconds=expires_in_minutes * 60)

        raise RuntimeError(
            "Invalid BLOB_STORAGE_CONNECTION_STRING. Provide either an AccountKey connection string "
            "(must include AccountName= and AccountKey=) or a SAS connection string "
            "(must include BlobEndpoint= and SharedAccessSignature=)."
        )

