import logging

import azure.functions as func

from shared.ingest import IngestionService, PipelineSettings

app = func.FunctionApp()
service = IngestionService(settings=PipelineSettings())


@app.blob_trigger(
    arg_name="input_blob",
    path="incoming/{name}",
    connection="BLOB_STORAGE_CONNECTION_STRING",
)
def ingest_pdf_blob(input_blob: func.InputStream) -> None:
    blob_name = input_blob.name.split("/")[-1]
    logging.info("Blob trigger received file: %s", blob_name)

    if not blob_name.lower().endswith(".pdf"):
        logging.warning("Skipped non-PDF file: %s", blob_name)
        return

    file_content = input_blob.read()
    try:
        chunk_count = service.process_pdf(source_file=blob_name, file_content=file_content)
        logging.info("Indexed %s chunks for %s", chunk_count, blob_name)
    except Exception as exc:
        logging.exception("Failed to process PDF %s: %s", blob_name, str(exc))
        raise
