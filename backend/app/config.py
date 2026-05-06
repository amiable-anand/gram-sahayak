from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_api_version: str = "2024-02-15-preview"
    azure_openai_chat_deployment: str
    azure_openai_embedding_deployment: str

    azure_search_endpoint: str
    azure_search_api_key: str
    azure_search_index_name: str
    azure_search_vector_field: str = "contentVector"
    azure_search_content_field: str = "content"
    azure_search_id_field: str = "id"
    azure_search_source_field: str = "source_file"
    azure_search_top_k: int = 4

    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def allow_cors_credentials(self) -> bool:
        return "*" not in self.cors_origin_list


@lru_cache
def get_settings() -> Settings:
    return Settings()
