import React, { useState } from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { 
  Plus, 
  Search, 
  Check, 
  CheckCircle2, 
  Clock, 
  Layers,
  BookOpen
} from 'lucide-react';

export const KnowledgeSidebar: React.FC = () => {
  const { 
    documents, 
    activeDocumentIds, 
    toggleDocumentActive, 
    setUploadDocumentModalOpen 
  } = useLearning();

  const { openDocumentStudy } = useApp();
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDocs = documents.filter(d => 
    d.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.topicCategory.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <aside className="w-72 flex-shrink-0 bg-white border-r border-[#E0DED7] flex flex-col h-full select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-[#E0DED7] flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-[#1F242E] font-serif-display flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#1E3A8A]" />
            Your Materials
          </h2>
          <p className="text-[11px] text-[#5F6470]">
            {activeDocumentIds.length} of {documents.length} active in Search
          </p>
        </div>

        <button
          onClick={() => setUploadDocumentModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium rounded-xl transition-all border border-[#161B22] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
          title="Upload new learning material"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </div>

      {/* Filter search */}
      <div className="px-3 py-2 border-b border-[#E0DED7] bg-[#FAF9F5]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#5F6470]" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter materials..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-[#D4D2C9] rounded-lg text-[#1F242E] placeholder-[#737887] focus:outline-none focus:border-[#1F242E]"
          />
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredDocs.map((doc) => {
          const isActive = activeDocumentIds.includes(doc.id);

          return (
            <div
              key={doc.id}
              className={`p-2.5 rounded-xl border transition-all ${
                isActive
                  ? 'bg-[#F2F0E8] border-[#D4D2C9] shadow-xs'
                  : 'bg-[#FAF9F5] border-[#E0DED7] opacity-80 hover:opacity-100 hover:border-[#D4D2C9]'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Active Checkbox for RAG filter */}
                <button
                  type="button"
                  onClick={() => toggleDocumentActive(doc.id)}
                  className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors border ${
                    isActive
                      ? 'bg-[#1F242E] border-[#1F242E] text-white'
                      : 'border-[#D4D2C9] bg-white hover:border-[#1F242E]'
                  }`}
                  title="Toggle inclusion in active search context"
                >
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p 
                    onClick={() => openDocumentStudy(doc.id)}
                    className="text-xs font-semibold text-[#1F242E] truncate cursor-pointer hover:text-[#1E3A8A]"
                    title={`Open ${doc.name} in Study Workspace`}
                  >
                    {doc.name}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#5F6470] font-mono">
                    <span className="uppercase px-1.5 py-0.5 bg-white border border-[#D4D2C9] rounded text-[#1F242E]">
                      {doc.type}
                    </span>
                    <span>•</span>
                    <span>{doc.pages}p</span>
                    <span>•</span>
                    <button
                      onClick={() => openDocumentStudy(doc.id)}
                      className="text-[#1E3A8A] hover:underline flex items-center gap-0.5 font-medium"
                    >
                      <BookOpen className="w-2.5 h-2.5" />
                      <span>Study</span>
                    </button>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-[#5F6470] truncate max-w-[130px]">
                      {doc.topicCategory}
                    </span>

                    {doc.status === 'ready' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-900 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                        <Clock className="w-2.5 h-2.5 text-amber-600 animate-spin" />
                        Indexing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredDocs.length === 0 && (
          <div className="text-center py-6 text-[#5F6470] text-xs">
            No matching documents found.
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#E0DED7] bg-[#FAF9F5] text-[11px] text-[#5F6470] flex items-center justify-between">
        <span>Knowledge Memory:</span>
        <span className="font-semibold text-[#1F242E] font-mono">1536-dim vectors</span>
      </div>
    </aside>
  );
};
