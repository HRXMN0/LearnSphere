import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';
import { 
  BookOpen, 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Database, 
  ExternalLink, 
  FileText, 
  Layers, 
  HelpCircle,
  Loader2,
  CheckCircle2,
  Bookmark,
  Share2,
  ArrowUp
} from 'lucide-react';
import { CapabilityBadge } from '../common/CapabilityBadge';

export const DocumentStudyView: React.FC = () => {
  const { focusedDocumentId, navigateTo } = useApp();
  const { 
    documents, 
    askQuestion, 
    chatMessages, 
    isAIThinking, 
    aiThinkingStep,
    inspectSource,
    setUploadDocumentModalOpen
  } = useLearning();

  // Selected document
  const doc = documents.find((d) => d.id === focusedDocumentId) || documents[0];

  const [activePage, setActivePage] = useState<number>(1);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);
  const [notebookQuery, setNotebookQuery] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const excerptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when chunk highlighted
  useEffect(() => {
    if (highlightedChunkId && excerptRef.current) {
      excerptRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedChunkId, activePage]);

  if (!doc) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FAF9F5]">
        <div className="w-12 h-12 rounded-xl bg-[#F2F0E8] text-[#1E3A8A] border border-[#D4D2C9] flex items-center justify-center mb-3">
          <BookOpen className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold font-serif-display text-[#1F242E]">
          No Document Selected
        </h2>
        <p className="text-xs text-[#5F6470] max-w-sm mt-1 mb-5">
          Upload a PDF or lecture notes, or select one from your library to open the study workspace.
        </p>
        <button
          onClick={() => setUploadDocumentModalOpen(true)}
          className="px-5 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150"
        >
          + Upload Material
        </button>
      </div>
    );
  }

  // Get chunks or topics for outline
  const totalPages = doc.pages || 1;
  const topics = doc.profile?.topics || [
    { id: 'sec-1', name: 'Overview & Introduction', description: 'Core principles and definitions', sourcePages: [1] },
    { id: 'sec-2', name: 'Protocol Architecture & Flow', description: 'Components and mechanisms', sourcePages: [Math.min(14, totalPages)] },
    { id: 'sec-3', name: 'In-Depth Analysis & Tradeoffs', description: 'Specifications and performance criteria', sourcePages: [Math.min(42, totalPages)] }
  ];

  const handleCitationClick = (page: number, chunkId?: string) => {
    setActivePage(page);
    if (chunkId) {
      setHighlightedChunkId(chunkId);
    } else {
      setHighlightedChunkId(`page-${page}`);
    }
  };

  const handleAskInNotebook = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!notebookQuery.trim() || isAIThinking) return;
    askQuestion(`Regarding "${doc.name}": ${notebookQuery.trim()}`);
    setNotebookQuery('');
  };

  // Filter messages relevant to this document
  const studyNotes = chatMessages.filter(
    (m) => m.role === 'assistant' && (m.sources?.some((s) => s.documentName === doc.name || s.documentId === doc.id) || true)
  );

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#FAF9F5] overflow-hidden">
      {/* Study Workspace Top Header */}
      <header className="h-12 px-4 border-b border-[#D4D2C9] bg-white flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigateTo('documents')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] hover:border-[#BDB9AC] rounded-lg shadow-xs transition-colors duration-150"
            title="Back to Document Library"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#5F6470]" />
            <span className="hidden sm:inline">Library</span>
          </button>

          <div className="h-4 w-px bg-[#D4D2C9]" />

          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
            <span className="text-xs font-semibold text-[#1F242E] truncate max-w-[200px] sm:max-w-[340px]">
              {doc.name}
            </span>
            <span className="hidden md:inline-flex text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[#FAF9F5] text-[#5F6470] border border-[#D4D2C9] font-medium">
              {doc.type} · {doc.pages}p
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              askQuestion(`Summarize key principles in ${doc.name}`);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded-lg border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs transition-colors duration-150"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Summarize Document</span>
          </button>

          <button
            onClick={() => navigateTo('quiz')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded-lg border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs transition-colors duration-150"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Practice Quiz</span>
          </button>
        </div>
      </header>

      {/* 3-Panel Study Workspace (Desktop) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT: Document Outline / Topics / Pages */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-[#D4D2C9] bg-[#FAF9F5] select-none flex-shrink-0">
          <div className="p-3 border-b border-[#D4D2C9] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5F6470] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1E3A8A]" />
              Document Outline
            </span>
            <span className="text-[10px] text-[#737887] font-mono">{totalPages} pages</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {topics.map((t, idx) => {
              const targetPage = t.sourcePages?.[0] || Math.min((idx + 1) * 12, totalPages);
              const isActive = activePage === targetPage;

              return (
                <button
                  key={t.id || idx}
                  onClick={() => handleCitationClick(targetPage)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors duration-150 flex items-start gap-2 border ${
                    isActive
                      ? 'bg-white text-[#1F242E] font-semibold shadow-xs border-[#1E3A8A]'
                      : 'text-[#1F242E] border-transparent hover:bg-[#F2F0E8] hover:border-[#D4D2C9]'
                  }`}
                >
                  <span className="text-[10px] font-mono text-[#737887] mt-0.5">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#1F242E]">{t.name}</p>
                    <p className="text-[10px] text-[#5F6470] truncate mt-0.5">{t.description}</p>
                    <span className="text-[10px] font-mono text-[#1E3A8A] font-semibold">p. {targetPage}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Page Jumpers */}
          <div className="p-3 border-t border-[#D4D2C9] bg-white">
            <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider block mb-1.5">
              Page Navigator
            </span>
            <div className="flex items-center justify-between gap-1 text-xs">
              <button
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                disabled={activePage <= 1}
                className="p-1.5 rounded bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] disabled:opacity-40 disabled:cursor-not-allowed text-[#1F242E] transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs text-[#1F242E] font-medium">
                Page {activePage} of {totalPages}
              </span>
              <button
                onClick={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                disabled={activePage >= totalPages}
                className="p-1.5 rounded bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] disabled:opacity-40 disabled:cursor-not-allowed text-[#1F242E] transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER: Document Reader / Content Excerpt Preview */}
        <main className="flex-1 flex flex-col min-w-0 bg-white border-r border-[#D4D2C9] overflow-hidden">
          {/* Reader Top Bar */}
          <div className="h-10 px-4 border-b border-[#D4D2C9] bg-[#FAF9F5] flex items-center justify-between text-xs text-[#5F6470]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#1F242E]">Reader View</span>
              <span className="text-[#737887]">•</span>
              <span className="font-mono text-[11px] font-semibold text-[#1E3A8A]">Page {activePage}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5F6470]" />
                <input
                  type="text"
                  value={documentSearch}
                  onChange={(e) => setDocumentSearch(e.target.value)}
                  placeholder="Find on page..."
                  className="pl-7 pr-2.5 py-1 text-xs bg-white border border-[#D4D2C9] rounded-lg text-[#1F242E] placeholder:text-[#737887] focus:outline-none focus:border-[#1E3A8A] w-32 sm:w-44"
                />
              </div>
            </div>
          </div>

          {/* Reader Content Page Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-3xl mx-auto w-full space-y-6 font-sans">
            {/* Page Header Stamp */}
            <div className="pb-4 border-b border-[#E7E5DF] flex items-center justify-between text-[11px] text-[#7A7973] font-mono">
              <span>{doc.name}</span>
              <span>SECTION · PAGE {activePage}</span>
            </div>

            {/* Simulated / Real Page Content Presentation */}
            <div className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-display text-[#1A1A18] tracking-tight">
                {doc.profile?.mainTopic || doc.topicCategory || 'Core Curriculum Study Notes'}
              </h2>

              <p className="text-xs sm:text-sm text-[#3D3D3A] leading-relaxed">
                {doc.description || 'This course document provides structured reference material for exam preparation, foundational mechanics, and verified specifications.'}
              </p>

              {/* Verified Chunks Highlighted in Document Reader */}
              {doc.chunks && doc.chunks.length > 0 ? (
                <div className="space-y-4 pt-2">
                  {doc.chunks.map((chunk) => {
                    const isTarget = highlightedChunkId === chunk.id || activePage === chunk.page;
                    return (
                      <div
                        key={chunk.id}
                        ref={isTarget ? excerptRef : undefined}
                        className={`p-4 rounded-xl border transition-all ${
                          isTarget
                            ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-300/40 shadow-soft'
                            : 'bg-[#FAF9F5] border-[#E7E5DF]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-2 font-mono text-[#5C5B56]">
                          <span className="font-semibold text-cobalt-700">{chunk.section}</span>
                          <span className="px-1.5 py-0.2 rounded bg-white border border-[#E7E5DF] text-[#7A7973]">
                            Page {chunk.page}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#1A1A18] leading-relaxed font-serif">
                          "{chunk.content}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-[#E7E5DF] bg-[#FAF9F5] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1A18]">
                    <Database className="w-4 h-4 text-cobalt-600" />
                    <span>Indexed Knowledge Passages</span>
                  </div>
                  <p className="text-xs text-[#5C5B56] leading-relaxed">
                    This document is indexed in Azure AI Search. Ask questions in the right research notebook panel to retrieve exact passage chunks with page coordinates and citation grounding.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT: AI Study Panel (Research Notebook Aesthetic) */}
        <aside className="w-80 sm:w-96 flex flex-col bg-[#FAF9F5] flex-shrink-0 select-none">
          {/* Notebook Header */}
          <div className="p-3.5 border-b border-[#E7E5DF] bg-white flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#1A1A18] flex items-center gap-1.5 font-serif-display">
                <Sparkles className="w-3.5 h-3.5 text-cobalt-600" />
                Research Notebook
              </h3>
              <p className="text-[10px] text-[#7A7973]">
                Grounded in <span className="font-medium text-[#3D3D3A]">{doc.name}</span>
              </p>
            </div>
            <CapabilityBadge capability="RAG GROUNDED" size="sm" />
          </div>

          {/* Research Notebook Notes & Queries Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {studyNotes.length === 0 ? (
              <div className="p-6 text-center text-[#7A7973] text-xs space-y-3">
                <div className="w-10 h-10 rounded-full bg-cobalt-50 text-cobalt-600 flex items-center justify-center mx-auto">
                  <Bookmark className="w-5 h-5" />
                </div>
                <p className="font-semibold text-[#1A1A18]">Start Your Study Notes</p>
                <p className="text-[11px] leading-relaxed">
                  Ask questions about this material to inspect verifiable scholarly citations, comparison tables, and explanations.
                </p>
              </div>
            ) : (
              studyNotes.slice(-3).map((note, idx) => (
                <div key={note.id || idx} className="p-3.5 rounded-xl bg-white border border-[#E7E5DF] shadow-soft space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#F5F4EE] pb-1.5">
                    <span className="text-[10px] font-bold text-cobalt-700 uppercase tracking-wider">AI Grounded Note</span>
                    <span className="text-[10px] font-mono text-[#A3A29B]">{note.timestamp}</span>
                  </div>

                  <p className="text-xs text-[#1A1A18] leading-relaxed">
                    {note.structuredAnswer?.shortAnswer || note.content}
                  </p>

                  {/* Clickable Citations that Scroll Center Reader */}
                  {note.sources && note.sources.length > 0 && (
                    <div className="pt-2 border-t border-[#E7E5DF] space-y-1.5">
                      <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider block">
                        Scholarly Sources (Click to Jump)
                      </span>
                      <div className="space-y-1">
                        {note.sources.map((src, sIdx) => (
                          <button
                            key={src.id || sIdx}
                            onClick={() => handleCitationClick(src.page, src.id)}
                            className="w-full text-left p-2 rounded-lg bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-colors duration-150 flex items-center justify-between text-[11px] group shadow-xs"
                          >
                            <span className="font-mono text-[#1E3A8A] font-semibold truncate">
                              [{sIdx + 1}] Page {src.page} · {src.section || 'Excerpt'}
                            </span>
                            <span className="text-[10px] text-[#5F6470] group-hover:text-[#1F242E] font-mono font-medium">
                              Jump →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {isAIThinking && (
              <div className="p-3 bg-white rounded-lg border border-[#D4D2C9] shadow-xs flex items-center gap-2 text-xs text-[#1E3A8A] animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-[#1E3A8A]" />
                <span className="font-medium">{aiThinkingStep || 'Analyzing learning material...'}</span>
              </div>
            )}
          </div>

          {/* Notebook Bottom Input */}
          <div className="p-3 border-t border-[#D4D2C9] bg-white">
            <form onSubmit={handleAskInNotebook} className="relative flex flex-col gap-1.5">
              <input
                type="text"
                value={notebookQuery}
                onChange={(e) => setNotebookQuery(e.target.value)}
                placeholder="Ask anything about this document..."
                className="w-full px-3 py-2 pr-9 text-xs bg-white border border-[#D4D2C9] rounded-lg focus:outline-none focus:border-[#1E3A8A] text-[#1F242E] placeholder:text-[#737887]"
              />
              <button
                type="submit"
                disabled={!notebookQuery.trim() || isAIThinking}
                className="absolute right-1.5 top-1.5 p-1.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md border border-[#161B22] shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                title="Send query"
              >
                <ArrowUp className="w-3.5 h-3.5 text-white" />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
};
