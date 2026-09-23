import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';
import { 
  Search, 
  FileText, 
  MessageSquare, 
  BookOpen, 
  Hash, 
  ArrowRight, 
  X,
  Database
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'document' | 'topic' | 'question' | 'source';
  title: string;
  subtitle: string;
  action: () => void;
}

export const GlobalSearchModal: React.FC = () => {
  const { isGlobalSearchOpen, setIsGlobalSearchOpen, openDocumentStudy, navigateTo } = useApp();
  const { documents, chatMessages, askQuestion } = useLearning();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGlobalSearchOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isGlobalSearchOpen]);

  if (!isGlobalSearchOpen) return null;

  // Build searchable index
  const results: SearchResult[] = [];
  const q = query.trim().toLowerCase();

  if (q.length > 0) {
    // 1. Documents
    documents.forEach((doc) => {
      if (
        doc.name.toLowerCase().includes(q) ||
        (doc.description && doc.description.toLowerCase().includes(q)) ||
        doc.topicCategory.toLowerCase().includes(q)
      ) {
        results.push({
          id: `doc-${doc.id}`,
          type: 'document',
          title: doc.name,
          subtitle: `${doc.pages} pages · ${doc.topicCategory}`,
          action: () => {
            setIsGlobalSearchOpen(false);
            openDocumentStudy(doc.id);
          },
        });
      }
    });

    // 2. Topics from document profiles or chunks
    documents.forEach((doc) => {
      if (doc.profile?.topics) {
        doc.profile.topics.forEach((t) => {
          if (
            t.name.toLowerCase().includes(q) ||
            (t.description && t.description.toLowerCase().includes(q))
          ) {
            results.push({
              id: `topic-${t.id || t.name}`,
              type: 'topic',
              title: t.name,
              subtitle: `Topic in ${doc.name}`,
              action: () => {
                setIsGlobalSearchOpen(false);
                navigateTo('workspace');
                askQuestion(`Explain ${t.name} from ${doc.name}`);
              },
            });
          }
        });
      }
    });

    // 3. Previous questions asked in chat
    chatMessages
      .filter((m) => m.role === 'user' && m.content.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((m) => {
        results.push({
          id: `q-${m.id}`,
          type: 'question',
          title: m.content,
          subtitle: `Previously asked at ${m.timestamp}`,
          action: () => {
            setIsGlobalSearchOpen(false);
            navigateTo('workspace');
          },
        });
      });

    // 4. Source chunks excerpts
    documents.forEach((doc) => {
      if (doc.chunks) {
        doc.chunks.forEach((chunk) => {
          if (chunk.content.toLowerCase().includes(q)) {
            results.push({
              id: `chunk-${chunk.id}`,
              type: 'source',
              title: chunk.section || `Page ${chunk.page}`,
              subtitle: `Excerpt in ${doc.name} (Page ${chunk.page})`,
              action: () => {
                setIsGlobalSearchOpen(false);
                openDocumentStudy(doc.id);
              },
            });
          }
        });
      }
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsGlobalSearchOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      } else if (q.length > 0) {
        setIsGlobalSearchOpen(false);
        navigateTo('workspace');
        askQuestion(query);
      }
    }
  };

  const typeIcons = {
    document: <FileText className="w-4 h-4 text-cobalt-600" />,
    topic: <Hash className="w-4 h-4 text-amber-600" />,
    question: <MessageSquare className="w-4 h-4 text-emerald-600" />,
    source: <Database className="w-4 h-4 text-indigo-600" />,
  };

  const typeLabels = {
    document: 'Document',
    topic: 'Curriculum Topic',
    question: 'Past Query',
    source: 'Verified Source',
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 select-none animate-fade-in"
      onClick={() => setIsGlobalSearchOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-float border border-[#E7E5DF] overflow-hidden flex flex-col max-h-[80vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E0DED7] bg-[#FAF9F5]">
          <Search className="w-4 h-4 text-[#5F6470] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search documents, topics, past questions, or citations..."
            className="flex-1 text-sm bg-transparent border-none text-[#1F242E] placeholder-[#737887] focus:outline-none font-sans"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#5F6470] hover:text-[#1F242E] rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[11px] font-mono text-[#5F6470] bg-[#E0DED7] px-1.5 py-0.5 rounded">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#F2F0E8]">
          {query.trim().length === 0 ? (
            <div className="p-6 text-center text-[#5F6470] text-xs">
              <p className="font-medium text-[#1F242E]">Quick search across your study workspace</p>
              <p className="text-[11px] mt-1 text-[#737887]">
                Type a term like <span className="font-semibold text-[#1E3A8A]">"TCP"</span>, <span className="font-semibold text-[#1E3A8A]">"Handshake"</span>, or <span className="font-semibold text-[#1E3A8A]">"Congestion"</span>
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-[#5F6470] text-xs">
              <p className="font-medium text-[#1F242E]">No matching material found for "{query}"</p>
              <p className="text-[11px] mt-1 text-[#737887]">
                Press <span className="font-mono bg-[#E0DED7] px-1.5 py-0.5 rounded text-[#1F242E]">Enter</span> to ask this query directly to the AI Assistant.
              </p>
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected ? 'bg-[#F2F0E8] border border-[#D4D2C9] text-[#1F242E] shadow-xs' : 'hover:bg-[#FAF9F5] text-[#1F242E] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-lg bg-white border border-[#D4D2C9] shadow-xs flex-shrink-0">
                      {typeIcons[item.type]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-[#1F242E] truncate">{item.title}</p>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#FAF9F5] text-[#5F6470] border border-[#E0DED7]">
                          {typeLabels[item.type]}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5F6470] truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 flex-shrink-0 ml-2 transition-transform ${isSelected ? 'text-[#1E3A8A] translate-x-0.5' : 'text-[#737887]'}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & shortcut guide */}
        <div className="px-4 py-2.5 bg-[#FAF9F5] border-t border-[#E0DED7] flex items-center justify-between text-[11px] text-[#5F6470]">
          <div className="flex items-center gap-3">
            <span><strong className="font-mono bg-[#E0DED7] px-1 py-0.5 rounded text-[#1F242E]">↑↓</strong> Navigate</span>
            <span><strong className="font-mono bg-[#E0DED7] px-1 py-0.5 rounded text-[#1F242E]">↵</strong> Open</span>
            <span><strong className="font-mono bg-[#E0DED7] px-1 py-0.5 rounded text-[#1F242E]">ESC</strong> Close</span>
          </div>
          <span className="text-[10px] text-[#737887]">Grounded Knowledge Base</span>
        </div>
      </div>
    </div>
  );
};
