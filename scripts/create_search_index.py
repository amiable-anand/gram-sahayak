import os

from azure.core.credentials import AzureKeyCredential
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    HnswAlgorithmConfiguration,
    SearchField,
    SearchFieldDataType,
    SearchIndex,
    SearchableField,
    SimpleField,
    VectorSearch,
    VectorSearchProfile,
)


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> None:
    endpoint = required_env("AZURE_SEARCH_ENDPOINT")
    api_key = required_env("AZURE_SEARCH_API_KEY")
    index_name = required_env("AZURE_SEARCH_INDEX_NAME")

    id_field = os.getenv("AZURE_SEARCH_ID_FIELD", "id")
    content_field = os.getenv("AZURE_SEARCH_CONTENT_FIELD", "content")
    source_field = os.getenv("AZURE_SEARCH_SOURCE_FIELD", "source_file")
    vector_field = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "contentVector")

    # Azure OpenAI `text-embedding-ada-002` returns 1536-d vectors.
    vector_dimensions = int(os.getenv("AZURE_SEARCH_VECTOR_DIMENSIONS", "1536"))

    client = SearchIndexClient(endpoint=endpoint, credential=AzureKeyCredential(api_key))

    vector_search = VectorSearch(
        algorithms=[
            HnswAlgorithmConfiguration(
                name="hnsw-default",
            )
        ],
        profiles=[
            VectorSearchProfile(
                name="vector-profile",
                algorithm_configuration_name="hnsw-default",
            )
        ],
    )

    fields = [
        SimpleField(name=id_field, type=SearchFieldDataType.String, key=True, filterable=True, sortable=True),
        SearchableField(
            name=content_field,
            type=SearchFieldDataType.String,
            searchable=True,
            filterable=False,
            sortable=False,
            facetable=False,
            analyzer_name="en.lucene",
        ),
        SimpleField(name=source_field, type=SearchFieldDataType.String, filterable=True, sortable=True, facetable=True),
        SimpleField(name="chunk_index", type=SearchFieldDataType.Int32, filterable=True, sortable=True),
        SearchField(
            name=vector_field,
            type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
            searchable=True,
            vector_search_dimensions=vector_dimensions,
            vector_search_profile_name="vector-profile",
        ),
    ]

    index = SearchIndex(name=index_name, fields=fields, vector_search=vector_search)

    existing = None
    try:
        existing = client.get_index(index_name)
    except Exception:
        existing = None

    if existing is None:
        client.create_index(index)
        print(f"Created Azure AI Search index: {index_name}")
    else:
        client.create_or_update_index(index)
        print(f"Updated Azure AI Search index: {index_name}")


if __name__ == "__main__":
    main()

