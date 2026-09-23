import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  ShieldCheck, 
  Cpu, 
  Database, 
  Key, 
  Globe, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Server,
  CloudCog,
  FileCode,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HealthData {
  status: string;
  azureOpenAI: boolean;
  azureSearch: boolean;
  searchReachable: boolean;
  index: string;
  deployments: {
    chat: string;
    embedding: string;
    vision?: string;
  };
  missing: string[];
  message: string;
}

export const SettingsView: React.FC = () => {
  const { addToast } = useApp();
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(false);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthData = await res.json();
        setHealthData(data);
      } else {
        throw new Error(`Health check returned status ${res.status}`);
      }
    } catch (err: any) {
      console.warn('Could not fetch backend health:', err);
      setHealthData({
        status: 'disconnected',
        azureOpenAI: false,
        azureSearch: false,
        searchReachable: false,
        index: 'learning-chunks',
        deployments: {
          chat: 'gpt-4.1-mini',
          embedding: 'text-embedding-3-small',
        },
        missing: ['BACKEND_CONNECTION_OFFLINE'],
        message: 'Backend server is not reachable on port 3001. Run "npm run server" to start it.',
      });
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5]">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E7E5DF]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#F2F0E8] text-[#1E3A8A] border border-[#E7E5DF]">
                <Settings className="w-4 h-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-serif-display text-[#1F242E] tracking-tight">
                Azure AI Services & Diagnostics
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#737887]">
              Real-time connectivity status to Microsoft Foundry, Azure OpenAI, and Azure AI Search index.
            </p>
          </div>

          <button
            onClick={fetchHealth}
            disabled={isLoadingHealth}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#FAF9F5] hover:bg-[#F2F0E8] text-[#1F242E] border border-[#E7E5DF] shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin' : ''}`} />
            <span>Check Connectivity</span>
          </button>
        </div>

        {/* Live Service Diagnostics Card */}
        <div className="bg-[#FAF9F5] rounded-xl border border-[#E7E5DF] p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-serif-display text-[#1F242E] flex items-center gap-2">
              <CloudCog className="w-4 h-4 text-[#1E3A8A]" />
              Live Azure Service Connectivity Status
            </h3>
            {healthData?.status === 'ok' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 flex items-center gap-1.5 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> All Azure Services Connected
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 flex items-center gap-1.5 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" /> Configuration Required
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Azure OpenAI */}
            <div className="p-4 rounded-lg border border-[#E7E5DF] bg-[#F2F0E8]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1F242E] flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#1E3A8A]" />
                  Azure OpenAI
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${healthData?.azureOpenAI ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </div>
              <p className="text-[11px] text-[#737887]">
                Chat Model: <span className="font-mono font-semibold text-[#1F242E]">{healthData?.deployments?.chat || 'gpt-4.1-mini'}</span>
              </p>
              <p className="text-[11px] text-[#737887]">
                Embeddings: <span className="font-mono font-semibold text-[#1F242E]">{healthData?.deployments?.embedding || 'text-embedding-3-small'}</span>
              </p>
            </div>

            {/* Azure AI Search */}
            <div className="p-4 rounded-lg border border-[#E7E5DF] bg-[#F2F0E8]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1F242E] flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-700" />
                  Azure AI Search
                </span>
                <span className={`w-2.5 h-2.5 rounded-full ${healthData?.azureSearch ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </div>
              <p className="text-[11px] text-[#737887]">
                Index: <span className="font-mono font-semibold text-[#1F242E]">{healthData?.index || 'learning-chunks'}</span>
              </p>
              <p className="text-[11px] text-[#737887]">
                Dimensions: <span className="font-mono font-semibold text-[#1F242E]">1536 (Cosine HNSW)</span>
              </p>
            </div>

            {/* Document Ingestion */}
            <div className="p-4 rounded-lg border border-[#E7E5DF] bg-[#F2F0E8]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1F242E] flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[#1E3A8A]" />
                  PDF Ingestion
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-[#737887]">
                Mode: <span className="font-semibold text-[#1F242E]">Local Extraction Layer</span>
              </p>
              <p className="text-[11px] text-[#737887]">
                Preserves exact page boundaries for grounded citations.
              </p>
            </div>
          </div>

          {healthData?.missing && healthData.missing.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Missing Environment Variables in server/.env
              </div>
              <p className="text-amber-800">
                The following Azure credentials need to be configured in <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded text-amber-900">server/.env</code>:
              </p>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-amber-900">
                {healthData.missing.map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Security & Secret Isolation */}
        <div className="bg-[#FAF9F5] rounded-xl border border-[#E7E5DF] p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#1E3A8A]" />
            <h3 className="text-sm font-bold font-serif-display text-[#1F242E]">Server-Side Security & Secret Isolation</h3>
          </div>
          <p className="text-xs text-[#737887] leading-relaxed">
            Per production security requirements, all Azure API keys and connection strings are strictly kept server-side in <code className="font-mono bg-[#F2F0E8] px-1 py-0.5 rounded text-[#1F242E]">server/.env</code> (which is included in <code className="font-mono bg-[#F2F0E8] px-1 py-0.5 rounded text-[#1F242E]">.gitignore</code>). The React/Vite client never receives or handles raw credentials.
          </p>

          <div className="p-4 bg-[#1F242E] text-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto space-y-1 border border-[#161B22]">
            <div className="text-slate-500"># Required server/.env specifications:</div>
            <div>PORT=3001</div>
            <div>AZURE_OPENAI_ENDPOINT=&lt;YOUR_AZURE_OPENAI_ENDPOINT&gt;</div>
            <div>AZURE_OPENAI_API_KEY=&lt;YOUR_AZURE_OPENAI_KEY&gt;</div>
            <div>AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4.1-mini</div>
            <div>AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small</div>
            <div>AZURE_SEARCH_ENDPOINT=https://learning-assistant-search.search.windows.net</div>
            <div>AZURE_SEARCH_API_KEY=&lt;YOUR_AZURE_SEARCH_ADMIN_KEY&gt;</div>
            <div>AZURE_SEARCH_INDEX=learning-chunks</div>
            <div>DOCUMENT_PROCESSING_MODE=local</div>
          </div>
        </div>
      </div>
    </div>
  );
};
