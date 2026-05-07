from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    query: str = Field(min_length=2, max_length=2000)
    language: str = Field(default="English", min_length=2, max_length=50, description="English/Hindi/Marathi")


class SourceChunk(BaseModel):
    id: str
    source_file: str | None = None
    content: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]


class CreateUploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=260)
    content_type: str = Field(default="application/pdf", min_length=3, max_length=200)


class CreateUploadUrlResponse(BaseModel):
    upload_url: str
    blob_name: str
    expires_in_seconds: int
