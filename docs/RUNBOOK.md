# Gram Sahayak Runbook (Credentials + Run + Deploy)

This document explains:

1) how to create the Azure credentials you need  
2) where to paste them  
3) how to run locally  
4) how to deploy to Azure with minimal cost

> Security note: never commit `.env` files or publish profiles to git. This repo’s `.gitignore` excludes `.env`.

## 1) Create Azure resources (lowest-cost)

You need:

- **Azure Storage**: Standard LRS
- **Azure AI Search**: Basic (vector search support)
- **Azure OpenAI**: resource + deployments
- **Azure App Service** (backend): Linux B1
- **Azure Functions** (pipeline): Consumption plan (Y1)
- **Azure Static Web Apps** (frontend): Free tier

### Option A: Create via Azure Portal (manual)

Create resources in any region that supports Azure OpenAI + Search.

### Option B: Provision baseline with Bicep (recommended)

See `infra/README.md`.

> Note: Azure OpenAI model deployments are created in Azure OpenAI Studio; Bicep does not reliably create deployments across all regions/subscriptions.

## 2) Create Azure OpenAI deployments (required)

In Azure OpenAI Studio:

- Create a **chat** deployment (set deployment name, example: `gpt-35-turbo`)
- Create an **embedding** deployment (set deployment name, example: `text-embedding-ada-002`)

You will use those names in:

- `AZURE_OPENAI_CHAT_DEPLOYMENT`
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`

## 3) Collect credentials (copy/paste)

### Azure OpenAI

From Azure Portal → your Azure OpenAI resource → “Keys and Endpoint”:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`

### Azure AI Search

From Azure Portal → your Search service:

- Overview → `AZURE_SEARCH_ENDPOINT` (`https://<name>.search.windows.net`)
- Keys → `AZURE_SEARCH_API_KEY` (Primary admin key)

### Azure Storage

From Azure Portal → your Storage account:

- Access keys → `BLOB_STORAGE_CONNECTION_STRING`
- Containers → ensure container named `incoming` exists

## 4) Where to put credentials

### Local dev

1) Backend:
   - Copy `.env.example` → `backend/.env`
   - Fill in values

2) Pipeline:
   - Copy `pipeline/local.settings.json.example` → `pipeline/local.settings.json`
   - Fill in values

3) Frontend:
   - Copy `frontend/.env.example` → `frontend/.env`
   - Set `VITE_API_BASE_URL=http://localhost:8000`

### Production (Azure)

Set the same keys in:

- **App Service (backend)** → Configuration → Application settings
- **Function App (pipeline)** → Configuration → Application settings

Set frontend:

- **Static Web Apps** → Environment variables:
  - `VITE_API_BASE_URL=https://<your-backend-app>.azurewebsites.net`

## 5) Create the Azure AI Search index (one-time)

This must be done before ingestion and before the backend can retrieve.

From repo root (Windows examples use `py`):

```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Ensure your environment variables are set (or create a root .env and export them)
py scripts/create_search_index.py
```

## 6) Run locally (end-to-end)

### Start backend

```bash
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Put Azure credentials in backend/.env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Check:

- `GET http://localhost:8000/health`

### Start frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open:

- `http://localhost:5173`

### Start pipeline (optional locally)

Install Azure Functions Core Tools, then:

```bash
cd pipeline
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

copy local.settings.json.example local.settings.json
func start
```

### Ingest a PDF

Upload any scheme PDF to the blob container `incoming`.

After ingestion:

1) open the frontend
2) ask a question that is answered by the PDF

## 7) Deploy to Azure (production)

### Backend → App Service (minimal cost)

- Create an App Service Plan: Linux **B1**
- Create Web App: Python 3.11
- Set App Settings from `.env.example`
- Deploy via GitHub Actions (`.github/workflows/backend-appservice.yml`) using publish profile secrets.

### Pipeline → Azure Functions (Consumption)

- Create Function App: Linux, Python 3.11, **Consumption**
- Set App Settings from `.env.example`
- Deploy via GitHub Actions (`.github/workflows/pipeline-functions.yml`) using publish profile secrets.

### Frontend → Static Web Apps (Free)

- Create Static Web App pointing to this repo
- Set SWA deployment token in GitHub Secrets:
  - `AZURE_STATIC_WEB_APPS_API_TOKEN`
- Set `VITE_API_BASE_URL` to your backend URL

## 8) After credentials are set: is it ready?

**Yes** — once:

- Search index exists
- A PDF has been ingested into the index
- Backend + frontend are deployed and `VITE_API_BASE_URL` points to backend

…then Gram Sahayak is fully functional.

