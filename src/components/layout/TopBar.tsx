import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';
import { 
  Search, 
  Plus, 
  Menu, 
  ShieldCheck, 
  Layers,
  ChevronDown,
  BookOpen
} from 'lucide-react';
import { ResponsibleAIModal } from '../evaluation/ResponsibleAIModal';
import { LearnSphereLogo } from '../common/LearnSphereLogo';

export const TopBar: React.FC = () => {
  const { 
    navigateTo, 
    setSidebarCollapsed,
    setIsGlobalSearchOpen,
    openDocumentStudy
  } = useApp();

  const { 
    documents, 
    activeDocumentIds, 
    isDemoMode, 
    setUploadDocumentModalOpen 
  } = useLearning();

  const [isResponsibleAIOpen, setIsResponsibleAIOpen] = useState(false);
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [azureHealth, setAzureHealth] = useState<{ status: string; index: string } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setAzureHealth(data))
      .catch(() => setAzureHealth({ status: 'offline', index: 'learning-chunks' }));
  }, []);

  const activeDoc = documents.find((d) => activeDocumentIds.includes(d.id));

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-3 sm:px-4 bg-white/95 backdrop-blur-md border-b border-[#E7E5DF] select-none">
      {/* Left: Brand & Workspace Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          className="p-1.5 rounded-lg text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8] active:bg-[#E7E5DF] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Product Brand */}
        <button 
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-2 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded-lg p-0.5 flex-shrink-0"
          aria-label="LearnSphere home"
        >
          <LearnSphereLogo variant="symbol" size="md" />
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm font-bold tracking-tight text-[#1F242E] font-serif-display">
                LearnSphere
              </span>
              <span className="px-1.5 py-0.2 bg-[#F2F0E8] text-[#1E3A8A] text-[10px] font-semibold rounded border border-[#D4D2C9]">
                AI-103
              </span>
            </div>
            <p className="text-[10px] text-[#737887] mt-0.5">Academic Study Workspace</p>
          </div>
        </button>

        {/* Workspace / Material Selector Capsule */}
        <div className="relative hidden xl:block ml-2">
          <button
            onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] text-xs font-medium border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
          >
            <Layers className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
            <span className="font-medium truncate max-w-[200px]">
              {isDemoMode
                ? 'CS 401: Computer Networks'
                : activeDoc
                ? activeDoc.name
                : `${documents.length} Materials in Library`}
            </span>
            <ChevronDown className="w-3 h-3 text-[#5F6470]" />
          </button>

          {isWorkspaceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-elevated border border-[#D4D2C9] p-2 z-50 animate-slide-up">
              <p className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider px-2 py-1">
                Select Active Material
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto mt-1">
                {documents.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      openDocumentStudy(d.id);
                      setIsWorkspaceDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 text-left rounded-lg text-xs hover:bg-[#F2F0E8] text-[#1F242E] transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
                      <span className="truncate font-medium">{d.name}</span>
                    </div>
                    <span className="text-[10px] text-[#737887] font-mono">{d.pages}p</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6">
        <button
          onClick={() => setIsGlobalSearchOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-white hover:bg-[#FAF9F5] text-[#5F6470] hover:text-[#1F242E] rounded-lg border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs text-xs transition-colors duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-[#5F6470] group-hover:text-[#1F242E] transition-colors" />
            <span className="truncate">Search documents, topics, sources...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-[#FAF9F5] border border-[#D4D2C9] text-[#5F6470] px-1.5 py-0.5 rounded shadow-xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Actions & Evaluation Modals */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* + Upload Material CTA (PRIMARY ACTION) */}
        <button
          onClick={() => setUploadDocumentModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
          title="Upload new document or lecture notes"
        >
          <Plus className="w-3.5 h-3.5 text-white stroke-[2.5]" />
          <span>Upload</span>
        </button>

        {/* Responsible AI Modal Trigger */}
        <button
          onClick={() => setIsResponsibleAIOpen(true)}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200/60 text-emerald-900 border border-emerald-300 shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          title="View Responsible AI Safeguards & Hallucination Mitigation"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
          <span>Responsible AI</span>
        </button>

        {/* Live Azure AI Health Status Badge */}
        <button
          onClick={() => navigateTo('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            azureHealth?.status === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
          }`}
          title="Azure AI Live Status (Click to inspect Settings)"
        >
          <span className={`w-2 h-2 rounded-full ${azureHealth?.status === 'ok' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
          <span className="hidden lg:inline">{azureHealth?.status === 'ok' ? 'Azure Live' : 'Azure Config'}</span>
        </button>

        {/* Evaluator / Student Avatar */}
        <div className="flex items-center pl-1.5 border-l border-[#E7E5DF]">
          <div className="w-7 h-7 rounded-full bg-[#1A1A18] text-white flex items-center justify-center font-medium text-xs shadow-soft">
            EV
          </div>
        </div>
      </div>

      {/* Modals */}
      <ResponsibleAIModal
        isOpen={isResponsibleAIOpen}
        onClose={() => setIsResponsibleAIOpen(false)}
      />
    </header>
  );
};
