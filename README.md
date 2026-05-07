# Gram Sahayak (Village Helper) — Azure RAG MVP

An Azure-focused MVP that ingests government scheme PDFs, chunks + embeds them, stores vectors in **Azure AI Search**, and serves a **FastAPI** RAG endpoint consumed by a **React (Vite) + Tailwind** chat UI.

## Is the app ready after adding Azure credentials?

**Yes.** After you:

- create the required Azure resources (or deploy them with `infra/main.bicep`)
- put the credentials into the correct places (local `.env`, Azure App Settings)
- run `scripts/create_search_index.py` once

…the application is ready to run locally and in Azure.

## Monorepo structure

```text
gram-sahayak/
  backend/                 # FastAPI RAG API (Azure App Service - Linux B1)
  pipeline/                # Azure Functions ingestion (Consumption)
  frontend/                # Vite React + Tailwind (Azure Static Web Apps - Free tier)
  scripts/                 # Utilities (create Azure AI Search index)
  infra/                   # Azure Bicep (minimal-cost)
  docs/                    # Setup + run instructions
  .env.example
  package.json
  requirements.txt
```

## Prerequisites

- Azure resources:
  - **Azure OpenAI** resource with deployments:
    - Chat: `gpt-35-turbo` (deployment name can be different; configure via env)
    - Embeddings: `text-embedding-ada-002`
  - **Azure AI Search** service (Basic tier is sufficient)
  - **Azure Storage Account** + **Blob container** named `incoming`
- Local tools:
  - Python 3.11+
  - Node 18+

## Create Azure credentials (what to create + where to get it)

This project uses **3 credential sets**.

### 1) Azure OpenAI (LLM + embeddings)

- **Create**: Azure OpenAI resource (or use an existing one)
- **Create deployments** (Azure OpenAI Studio → Deployments):
  - Chat deployment (example deployment name: `gpt-35-turbo`)
  - Embedding deployment (example deployment name: `text-embedding-ada-002`)
- **Get these values** (Azure Portal → Azure OpenAI resource → “Keys and Endpoint”):
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
- **Set these to your deployment names** (from Azure OpenAI Studio):
  - `AZURE_OPENAI_CHAT_DEPLOYMENT`
  - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`

### 2) Azure AI Search (vector database)

- **Create**: Azure AI Search service (SKU **Basic** to support vector search)
- **Get these values**:
  - `AZURE_SEARCH_ENDPOINT`: service URL (looks like `https://<name>.search.windows.net`)
  - `AZURE_SEARCH_API_KEY`: “Primary admin key” (Portal → Search service → Keys)
  - `AZURE_SEARCH_INDEX_NAME`: default `gram-sahayak-index` (you can change it)

### 3) Azure Storage (PDF uploads)

- **Create**: Storage Account (Standard **LRS**) + Blob container named `incoming`
- **Get this value**:
  - `BLOB_STORAGE_CONNECTION_STRING`: Portal → Storage account → Access keys → Connection string

## Where to put Azure credentials (local + production)

### Local development

- **Backend**: copy `.env.example` → `backend/.env` and fill in values
- **Pipeline**: copy `pipeline/local.settings.json.example` → `pipeline/local.settings.json` and fill in values
- **Frontend**: copy `frontend/.env.example` → `frontend/.env`

### Production (Azure)

- **Backend**: App Service → Configuration → Application settings
- **Pipeline**: Function App → Configuration → Application settings
- **Frontend**: Azure Static Web Apps → Environment variables (set `VITE_API_BASE_URL`)

## Environment variables reference

The required keys are listed in `.env.example`.

- **Backend** reads `.env` values via `pydantic-settings` (`backend/app/config.py`)
- **Pipeline** reads values from Function App settings (or `pipeline/local.settings.json` locally)
- **Frontend** reads `VITE_API_BASE_URL` from `frontend/.env`

## 1) Create the Azure AI Search index (required before ingestion)

From repo root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python scripts/create_search_index.py
```

## 2) Run backend locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp ../.env.example .env
# edit backend/.env with real values

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET /health`

RAG endpoint: `POST /api/ask`

Payload:

```json
{ "query": "user question", "language": "Hindi/Marathi/English" }
```

## 3) Run frontend locally

```bash
cd frontend
npm install
cp .env.example .env

npm run dev
```

Set `VITE_API_BASE_URL` to your deployed backend URL when hosting on Azure Static Web Apps.

## 4) Run pipeline locally (Azure Functions)

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp local.settings.json.example local.settings.json
# edit pipeline/local.settings.json with real values

func start
```

Upload a PDF to the `incoming` container to trigger ingestion.

## Azure deployment notes (high-level)

- **Frontend**: deploy `frontend/` to Azure Static Web Apps (build command `npm run build`, output `dist`).
- **Backend**: deploy `backend/` to Azure App Service (Linux B1). Configure app settings from `.env.example`.
- **Pipeline**: deploy `pipeline/` to Azure Functions (Consumption). Configure function app settings from `.env.example` and ensure Blob trigger connection is set.

## GitHub Actions deployment (production-friendly)

This repo includes workflows for:

- `frontend/` → Azure Static Web Apps
- `backend/` → Azure App Service (zip deploy)
- `pipeline/` → Azure Functions (publish profile deploy)

### Required GitHub Secrets

- **Frontend**
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`: SWA deployment token (from Static Web Apps “Manage deployment token”)
- **Backend**
  - `AZURE_WEBAPP_NAME`: App Service name (e.g. `gramsahayak-api-xxxx`)
  - `AZURE_WEBAPP_PUBLISH_PROFILE`: publish profile XML for the Web App
- **Pipeline**
  - `AZURE_FUNCTIONAPP_NAME`: Function App name (e.g. `gramsahayak-fn-xxxx`)
  - `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`: publish profile XML for the Function App

### App settings (Azure Portal → Configuration)

Set these for the Web App and Function App (values documented in `.env.example`):

- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION`
- `AZURE_OPENAI_CHAT_DEPLOYMENT`, `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_API_KEY`, `AZURE_SEARCH_INDEX_NAME`
- Backend only: `CORS_ORIGINS`
- Pipeline only: `BLOB_STORAGE_CONNECTION_STRING`

## Full step-by-step runbook

See `docs/RUNBOOK.md`.

## One-command local run (recommended)

After you’ve logged into Azure CLI (`az login`) and created resources in `gram-sahayak-rg`, you can run everything with:

```powershell
cd C:\Users\91953\gram-sahayak
.\run-local.ps1
```

What it does:

- pulls **fresh** Azure OpenAI/Search/Storage values from Azure (prevents the blob connection string issue)
- writes/updates:
  - `backend/.env`
  - `pipeline/local.settings.json`
  - `frontend/.env`
- opens 2–3 terminals to start:
  - backend (`uvicorn`)
  - frontend (`vite`)
  - pipeline (`func start`) if installed


