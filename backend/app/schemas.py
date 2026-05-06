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
