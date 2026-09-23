import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory or server directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server', '.env') });

export interface AzureConfig {
  openAI: {
    endpoint: string;
    apiKey: string;
    chatDeployment: string;
    embeddingDeployment: string;
    visionDeployment: string;
    apiVersion: string;
    isConfigured: boolean;
  };
  search: {
    endpoint: string;
    apiKey: string;
    indexName: string;
    apiVersion: string;
    isConfigured: boolean;
  };
  speech: {
    key: string;
    region: string;
    isConfigured: boolean;
  };
  documentProcessingMode: 'local' | 'azure-content-understanding';
  port: number;
}

const openAIEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
const openAIApiKey = process.env.AZURE_OPENAI_API_KEY || '';
const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4.1-mini';
const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small';
const visionDeployment = process.env.AZURE_OPENAI_VISION_DEPLOYMENT || chatDeployment;
const openAIApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT || 'https://learning-assistant-search.search.windows.net';
const searchApiKey = process.env.AZURE_SEARCH_API_KEY || '';
const searchIndexName = process.env.AZURE_SEARCH_INDEX || 'learning-chunks';
const searchApiVersion = process.env.AZURE_SEARCH_API_VERSION || '2024-07-01';

const speechKey = (process.env.AZURE_SPEECH_KEY || process.env.SPEECH_KEY || '').trim();
const rawRegion = (process.env.AZURE_SPEECH_REGION || process.env.SPEECH_REGION || 'uaenorth').trim().toLowerCase();
const speechRegion = rawRegion.replace(/[\s_-]+/g, '');

export const config: AzureConfig = {
  openAI: {
    endpoint: openAIEndpoint,
    apiKey: openAIApiKey,
    chatDeployment,
    embeddingDeployment,
    visionDeployment,
    apiVersion: openAIApiVersion,
    isConfigured: Boolean(openAIEndpoint && openAIApiKey && !openAIApiKey.includes('your_') && !openAIApiKey.includes('<REAL_')),
  },
  search: {
    endpoint: searchEndpoint,
    apiKey: searchApiKey,
    indexName: searchIndexName,
    apiVersion: searchApiVersion,
    isConfigured: Boolean(searchEndpoint && searchApiKey && !searchApiKey.includes('your_') && !searchApiKey.includes('<REAL_')),
  },
  speech: {
    key: speechKey,
    region: speechRegion,
    isConfigured: Boolean(speechKey && !speechKey.includes('your_') && !speechKey.includes('<REAL_')),
  },
  documentProcessingMode: (process.env.DOCUMENT_PROCESSING_MODE as 'local' | 'azure-content-understanding') || 'local',
  port: parseInt(process.env.PORT || '3001', 10),
};

export function getHealthStatus() {
  const missingVars: string[] = [];

  if (!config.openAI.endpoint || config.openAI.endpoint.includes('your-openai-resource') || config.openAI.endpoint.includes('<REAL_')) {
    missingVars.push('AZURE_OPENAI_ENDPOINT');
  }
  if (!config.openAI.apiKey || config.openAI.apiKey.includes('your_') || config.openAI.apiKey.includes('<REAL_')) {
    missingVars.push('AZURE_OPENAI_API_KEY');
  }
  if (!config.search.endpoint || config.search.endpoint.includes('your-search-service') || config.search.endpoint.includes('<REAL_')) {
    missingVars.push('AZURE_SEARCH_ENDPOINT');
  }
  if (!config.search.apiKey || config.search.apiKey.includes('your_') || config.search.apiKey.includes('<REAL_')) {
    missingVars.push('AZURE_SEARCH_API_KEY');
  }
  if (!config.speech.key || config.speech.key.includes('your_') || config.speech.key.includes('<REAL_')) {
    missingVars.push('AZURE_SPEECH_KEY');
  }

  const isFullyConfigured = missingVars.length === 0;

  return {
    status: isFullyConfigured ? 'ok' : 'configuration_required',
    azureConfigured: isFullyConfigured,
    azureOpenAI: config.openAI.isConfigured,
    azureSearch: config.search.isConfigured,
    azureSpeech: config.speech.isConfigured,
    index: config.search.indexName,
    documentProcessingMode: config.documentProcessingMode,
    deployments: {
      chat: config.openAI.chatDeployment,
      embedding: config.openAI.embeddingDeployment,
      vision: config.openAI.visionDeployment,
      searchIndex: config.search.indexName,
      speechRegion: config.speech.region,
    },
    missing: missingVars,
    message: isFullyConfigured
      ? 'All Azure AI endpoints and deployments are configured.'
      : `Missing required environment variables: ${missingVars.join(', ')}. Set them in server/.env.`,
  };
}
