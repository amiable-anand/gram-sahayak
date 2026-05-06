@description('Location for all resources.')
param location string = resourceGroup().location

@description('Short unique prefix for globally-unique names.')
param namePrefix string = 'gramsahayak'

@description('Enable Azure OpenAI resource creation (some subscriptions require prior approval).')
param createOpenAI bool = true

@description('Existing Azure OpenAI resource name (used when createOpenAI=false).')
param existingOpenAIName string = ''

@description('Existing Azure OpenAI endpoint (used when createOpenAI=false).')
param existingOpenAIEndpoint string = ''

@description('Existing Azure OpenAI API key (used when createOpenAI=false).')
@secure()
param existingOpenAIKey string = ''

@description('Azure OpenAI API version.')
param openAIApiVersion string = '2024-02-15-preview'

@description('Azure OpenAI chat deployment name.')
param chatDeploymentName string = 'gpt-35-turbo'

@description('Azure OpenAI embedding deployment name.')
param embeddingDeploymentName string = 'text-embedding-ada-002'

@description('CORS origins for backend (comma-separated).')
param corsOrigins string = 'http://localhost:5173'

var uniq = toLower(uniqueString(resourceGroup().id))
var storageName = toLower('${namePrefix}st${substring(uniq, 0, 10)}')
var searchName = toLower('${namePrefix}srch${substring(uniq, 0, 8)}')
var appServicePlanName = '${namePrefix}-plan'
var webAppName = '${namePrefix}-api-${substring(uniq, 0, 8)}'
var functionAppName = '${namePrefix}-fn-${substring(uniq, 0, 8)}'
var appInsightsName = '${namePrefix}-ai'
var logWorkspaceName = '${namePrefix}-law'
var openAIName = toLower('${namePrefix}-oai-${substring(uniq, 0, 8)}')
var searchIndexName = 'gram-sahayak-index'
var blobContainerName = 'incoming'

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

var storageKey = storage.listKeys().keys[0].value
var storageConn = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storageKey};EndpointSuffix=${environment().suffixes.storage}'

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  name: '${storage.name}/default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storage.name}/default/${blobContainerName}'
  properties: {
    publicAccess: 'None'
  }
  dependsOn: [
    blobService
  ]
}

resource search 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchName
  location: location
  sku: {
    name: 'basic'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'Enabled'
  }
}

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logWorkspaceName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource web 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: false
      ftpsState: 'Disabled'
      http20Enabled: true
      linuxFxVersion: 'PYTHON|3.11'
      appCommandLine: 'gunicorn -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:$PORT app.main:app'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8000' }
        { name: 'PORT', value: '8000' }
        { name: 'CORS_ORIGINS', value: corsOrigins }
        { name: 'AZURE_OPENAI_ENDPOINT', value: createOpenAI ? ('https://${openAI.name}.openai.azure.com') : existingOpenAIEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', value: createOpenAI ? listKeys(openAI.id, '2024-10-01').key1 : existingOpenAIKey }
        { name: 'AZURE_OPENAI_API_VERSION', value: openAIApiVersion }
        { name: 'AZURE_OPENAI_CHAT_DEPLOYMENT', value: chatDeploymentName }
        { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', value: embeddingDeploymentName }
        { name: 'AZURE_SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
        { name: 'AZURE_SEARCH_API_KEY', value: listAdminKeys(search.id, '2023-11-01').primaryKey }
        { name: 'AZURE_SEARCH_INDEX_NAME', value: searchIndexName }
        { name: 'AZURE_SEARCH_TOP_K', value: '4' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: ai.properties.ConnectionString }
      ]
    }
  }
  dependsOn: [
    openAI
  ]
}

resource funcPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${namePrefix}-funcplan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource func 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: funcPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'python' }
        { name: 'AzureWebJobsStorage', value: storageConn }
        { name: 'BLOB_STORAGE_CONNECTION_STRING', value: storageConn }
        { name: 'BLOB_CONTAINER_NAME', value: blobContainerName }
        { name: 'AZURE_OPENAI_ENDPOINT', value: createOpenAI ? ('https://${openAI.name}.openai.azure.com') : existingOpenAIEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', value: createOpenAI ? listKeys(openAI.id, '2024-10-01').key1 : existingOpenAIKey }
        { name: 'AZURE_OPENAI_API_VERSION', value: openAIApiVersion }
        { name: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', value: embeddingDeploymentName }
        { name: 'AZURE_SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
        { name: 'AZURE_SEARCH_API_KEY', value: listAdminKeys(search.id, '2023-11-01').primaryKey }
        { name: 'AZURE_SEARCH_INDEX_NAME', value: searchIndexName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: ai.properties.ConnectionString }
      ]
    }
  }
  dependsOn: [
    container
    openAI
  ]
}

resource openAI 'Microsoft.CognitiveServices/accounts@2024-10-01' = if (createOpenAI) {
  name: openAIName
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

// NOTE: Model deployments for Azure OpenAI are subscription/region dependent.
// You can create deployments in the Azure portal and set deployment names via env vars.

output storageAccountName string = storage.name
output blobContainer string = blobContainerName
output searchServiceName string = search.name
output searchIndexName string = searchIndexName
output webAppName string = web.name
output functionAppName string = func.name
output openAIResourceName string = createOpenAI ? openAI.name : existingOpenAIName

