# Infrastructure (minimal-cost Azure)

This folder contains a minimal-cost baseline using:

- **Azure Static Web Apps** (Free) for `frontend/` (deployed separately via SWA)
- **Azure App Service** Linux **B1** for `backend/`
- **Azure Functions** Linux **Consumption (Y1)** for `pipeline/` (Blob-trigger ingestion)
- **Azure AI Search** **Basic** for vectors
- **Azure Storage** Standard LRS for PDF uploads
- **Azure OpenAI** for chat + embeddings (cost depends on usage)
- **Application Insights** for logs/metrics (uses a Log Analytics workspace)

## Deploy with Bicep

```bash
az group create -n gram-sahayak-rg -l centralindia
az deployment group create \
  -g gram-sahayak-rg \
  -f infra/main.bicep \
  -p @infra/main.parameters.json
```

## Important notes

- **Azure OpenAI deployments** (model deployment names) vary by region/subscription.
  - Create deployments in the Azure Portal, then set:
    - `AZURE_OPENAI_CHAT_DEPLOYMENT`
    - `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`
- The backend Web App in this template uses a placeholder container image string.
  - Deploy the container to ACR or GHCR and update Web App container settings (or convert to code-based deployment).

