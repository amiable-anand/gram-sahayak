param(
  [string]$ResourceGroup = "gram-sahayak-rg",
  [string]$BackendPort = "8000",
  [string]$FrontendPort = "5173",
  [switch]$NoPipeline
)

$ErrorActionPreference = "Stop"

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command '$name'. Install it and retry."
  }
}

Require-Cmd az
Require-Cmd python
Require-Cmd npm

Write-Host "Syncing Azure settings from resource group '$ResourceGroup'..." -ForegroundColor Cyan

$storage = az storage account list -g $ResourceGroup --query "[0].name" -o tsv
if ([string]::IsNullOrWhiteSpace($storage)) { throw "No Storage Account found in resource group '$ResourceGroup'." }
$storageConn = az storage account show-connection-string -g $ResourceGroup -n $storage --query connectionString -o tsv

$search = az search service list -g $ResourceGroup --query "[0].name" -o tsv
if ([string]::IsNullOrWhiteSpace($search)) { throw "No Azure AI Search service found in resource group '$ResourceGroup'." }
$searchEndpoint = "https://$search.search.windows.net"
$searchKey = az search admin-key show -g $ResourceGroup --service-name $search --query primaryKey -o tsv

$oai = az cognitiveservices account list -g $ResourceGroup --query "[?kind=='OpenAI'].name | [0]" -o tsv
if ([string]::IsNullOrWhiteSpace($oai)) { throw "No Azure OpenAI resource found in resource group '$ResourceGroup'." }
$oaiEndpoint = az cognitiveservices account show -g $ResourceGroup -n $oai --query properties.endpoint -o tsv
$oaiKey = az cognitiveservices account keys list -g $ResourceGroup -n $oai --query key1 -o tsv

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendEnvPath = Join-Path $repoRoot "backend\.env"
$pipelineSettingsPath = Join-Path $repoRoot "pipeline\local.settings.json"

if (-not (Test-Path $backendEnvPath)) { New-Item -ItemType File -Path $backendEnvPath | Out-Null }

function Upsert-EnvLine([string[]]$lines, [string]$key, [string]$value) {
  $filtered = $lines | Where-Object { $_ -notmatch ("^" + [regex]::Escape($key) + "=") }
  return @($filtered + ("$key=$value"))
}

$envLines = Get-Content $backendEnvPath -ErrorAction SilentlyContinue
if ($null -eq $envLines) { $envLines = @() }

$envLines = Upsert-EnvLine $envLines "AZURE_OPENAI_ENDPOINT" $oaiEndpoint
$envLines = Upsert-EnvLine $envLines "AZURE_OPENAI_API_KEY" $oaiKey
$envLines = Upsert-EnvLine $envLines "AZURE_OPENAI_API_VERSION" "2024-02-15-preview"

# Keep your existing deployment names if you customized them; otherwise set recommended defaults.
if (-not ($envLines -match "^AZURE_OPENAI_CHAT_DEPLOYMENT=")) { $envLines = Upsert-EnvLine $envLines "AZURE_OPENAI_CHAT_DEPLOYMENT" "gpt-4o-mini" }
if (-not ($envLines -match "^AZURE_OPENAI_EMBEDDING_DEPLOYMENT=")) { $envLines = Upsert-EnvLine $envLines "AZURE_OPENAI_EMBEDDING_DEPLOYMENT" "text-embedding-ada-002" }

$envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_ENDPOINT" $searchEndpoint
$envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_API_KEY" $searchKey
if (-not ($envLines -match "^AZURE_SEARCH_INDEX_NAME=")) { $envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_INDEX_NAME" "gram-sahayak-index" }
if (-not ($envLines -match "^AZURE_SEARCH_VECTOR_DIMENSIONS=")) { $envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_VECTOR_DIMENSIONS" "1536" }
$envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_TOP_K" "8"
$envLines = Upsert-EnvLine $envLines "AZURE_SEARCH_CANDIDATE_POOL" "24"
$envLines = Upsert-EnvLine $envLines "ENABLE_QUERY_TRANSLATION_FOR_RETRIEVAL" "true"

$envLines = Upsert-EnvLine $envLines "CORS_ORIGINS" "http://localhost:$FrontendPort"
$envLines = Upsert-EnvLine $envLines "BLOB_STORAGE_CONNECTION_STRING" $storageConn
if (-not ($envLines -match "^BLOB_CONTAINER_NAME=")) { $envLines = Upsert-EnvLine $envLines "BLOB_CONTAINER_NAME" "incoming" }

Set-Content -Path $backendEnvPath -Value $envLines -Encoding utf8

Write-Host "Updated backend env: $backendEnvPath" -ForegroundColor Green

$pipelineSettings = @{
  IsEncrypted = $false
  Values = @{
    AzureWebJobsStorage = $storageConn
    FUNCTIONS_WORKER_RUNTIME = "python"
    BLOB_STORAGE_CONNECTION_STRING = $storageConn
    BLOB_CONTAINER_NAME = "incoming"
    AZURE_OPENAI_ENDPOINT = $oaiEndpoint
    AZURE_OPENAI_API_KEY = $oaiKey
    AZURE_OPENAI_API_VERSION = "2024-02-15-preview"
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT = "text-embedding-ada-002"
    AZURE_SEARCH_ENDPOINT = $searchEndpoint
    AZURE_SEARCH_API_KEY = $searchKey
    AZURE_SEARCH_INDEX_NAME = "gram-sahayak-index"
    AZURE_SEARCH_VECTOR_FIELD = "contentVector"
    AZURE_SEARCH_CONTENT_FIELD = "content"
    AZURE_SEARCH_ID_FIELD = "id"
    AZURE_SEARCH_SOURCE_FIELD = "source_file"
  }
}

$pipelineDir = Split-Path -Parent $pipelineSettingsPath
if (-not (Test-Path $pipelineDir)) { New-Item -ItemType Directory -Force -Path $pipelineDir | Out-Null }
$pipelineSettings | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 $pipelineSettingsPath
Write-Host "Updated pipeline settings: $pipelineSettingsPath" -ForegroundColor Green

# Frontend env
$frontendEnvPath = Join-Path $repoRoot "frontend\.env"
if (-not (Test-Path $frontendEnvPath)) { New-Item -ItemType File -Path $frontendEnvPath | Out-Null }
$frontendLines = Get-Content $frontendEnvPath -ErrorAction SilentlyContinue
if ($null -eq $frontendLines) { $frontendLines = @() }
$frontendLines = Upsert-EnvLine $frontendLines "VITE_API_BASE_URL" "http://localhost:$BackendPort"
Set-Content -Path $frontendEnvPath -Value $frontendLines -Encoding utf8
Write-Host "Updated frontend env: $frontendEnvPath" -ForegroundColor Green

Write-Host "Starting services..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd `"$repoRoot\backend`"; if (!(Test-Path .venv)) { python -m venv .venv }; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt; uvicorn app.main:app --reload --host 0.0.0.0 --port $BackendPort"
)

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd `"$repoRoot\frontend`"; npm install; npm run dev -- --port $FrontendPort"
)

if (-not $NoPipeline) {
  if (Get-Command func -ErrorAction SilentlyContinue) {
    Start-Process powershell -ArgumentList @(
      "-NoExit",
      "-Command",
      "cd `"$repoRoot\pipeline`"; if (!(Test-Path .venv)) { python -m venv .venv }; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt; func start"
    )
  } else {
    Write-Host "Skipping pipeline start (func not installed). Install Azure Functions Core Tools to run ingestion locally." -ForegroundColor Yellow
  }
}

Write-Host "Done. Open http://localhost:$FrontendPort" -ForegroundColor Green

