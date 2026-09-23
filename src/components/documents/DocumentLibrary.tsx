import React, { useState } from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { 
  FolderGit2, 
  Search, 
  Plus, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ArrowRight,
  Filter,
  ArrowUpDown,
  BookOpen,
  MessageSquare,
  HelpCircle,
  UploadCloud,
  FileCode,
  FileImage
} from 'lucide-react';
import { DocumentUploadModal } from './DocumentUploadModal';

export const DocumentLibrary: React.FC = () => {
  const { 
    documents, 
    activeDocumentIds, 
    toggleDocumentActive, 
    deleteDocument, 
    setUploadDocumentModalOpen,
    isDemoMode,
    uploadDocument
  } = useLearning();

  const { navigateTo, openDocumentStudy } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'pages'>('recent');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const dynamicCategories = isDemoMode
    ? ['all', 'Transport Layer', 'Architecture & OSI', 'Protocol Reference', 'Security']
    : ['all', ...Array.from(new Set(documents.map(d => d.topicCategory || d.profile?.subject).filter(Boolean) as string[]))];

  // Filter & sort documents
  let filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (doc.description && doc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || 
                       (doc.topicCategory && doc.topicCategory.toLowerCase().includes(selectedCategory.toLowerCase())) ||
                       (doc.profile?.subject && doc.profile.subject.toLowerCase().includes(selectedCategory.toLowerCase()));
    return matchesSearch && matchesCat;
  });

  if (sortBy === 'name') {
    filteredDocs.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'pages') {
    filteredDocs.sort((a, b) => (b.pages || 0) - (a.pages || 0));
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadDocument(file);
    }
  };

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <FileImage className="w-4 h-4 text-indigo-600" />;
      case 'notes':
        return <FileCode className="w-4 h-4 text-emerald-600" />;
      default:
        return <FileText className="w-4 h-4 text-cobalt-600" />;
    }
  };

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5] min-h-full relative select-none"
    >
      {/* Drag & drop overlay indicator */}
      {isDraggingOver && (
        <div className="absolute inset-4 z-40 bg-cobalt-50/90 border-2 border-dashed border-cobalt-500 rounded-3xl flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs animate-fade-in">
          <UploadCloud className="w-12 h-12 text-cobalt-600 animate-bounce mb-2" />
          <p className="text-base font-bold font-serif-display text-cobalt-900">
            Drop your study material to upload
          </p>
          <p className="text-xs text-cobalt-700 mt-1 font-mono">
            Directly parse, chunk, and index into Azure AI Search
          </p>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#E7E5DF]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-cobalt-50 text-cobalt-700">
                <FolderGit2 className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-[#1A1A18] tracking-tight">
                Library
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#F5F4EE] text-[#5C5B56] text-xs font-mono font-medium border border-[#E7E5DF]">
                {documents.length} materials
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#7A7973]">
              Everything you've added to your learning workspace.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUploadDocumentModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>+ Add material</span>
            </button>
          </div>
        </div>

        {/* Search, Category Filter, and Sort Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#D4D2C9] shadow-xs">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5F6470]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, topic, or concept..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D4D2C9] rounded-lg focus:outline-none focus:border-[#1E3A8A] text-[#1F242E] placeholder:text-[#737887]"
            />
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {dynamicCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize whitespace-nowrap transition-colors duration-150 ${
                  selectedCategory === cat
                    ? 'bg-[#1F242E] text-white font-semibold border border-[#161B22] shadow-xs'
                    : 'bg-white text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8] border border-[#D4D2C9]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-[#5F6470]">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#5F6470]" />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-white border border-[#D4D2C9] rounded-lg px-2.5 py-1.5 text-xs text-[#1F242E] font-medium focus:outline-none focus:border-[#1E3A8A]"
            >
              <option value="recent">Sort: Recently Studied</option>
              <option value="name">Sort: Title (A-Z)</option>
              <option value="pages">Sort: Page Count</option>
            </select>
          </div>
        </div>

        {/* Refined Digital Archive Document List */}
        {filteredDocs.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#D4D2C9] p-10 text-center shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#F2F0E8] text-[#1E3A8A] border border-[#D4D2C9] flex items-center justify-center mx-auto">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-serif-display text-[#1F242E]">
              No learning materials match your filter
            </h3>
            <p className="text-xs text-[#5F6470] max-w-sm mx-auto">
              Upload your lecture slides, notes, or textbooks to start asking questions grounded in your course.
            </p>
            <button
              onClick={() => setUploadDocumentModalOpen(true)}
              className="px-5 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150"
            >
              + Upload Material
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((doc, idx) => {
              const isActiveInRAG = activeDocumentIds.includes(doc.id);
              const lastStudiedText = idx === 0 ? 'Last studied 12 min ago' : idx === 1 ? 'Last studied yesterday' : 'Studied recently';

              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-[#E7E5DF] hover:border-[#DEDBD2] p-4 sm:p-5 shadow-soft hover:shadow-subtle transition-all space-y-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Document Meta */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF9F5] border border-[#E7E5DF] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getFormatIcon(doc.type)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-semibold text-[#1A1A18] tracking-tight truncate">
                            {doc.name}
                          </h3>
                          <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 bg-[#FAF9F5] rounded border border-[#E7E5DF] text-[#5C5B56]">
                            {doc.type}
                          </span>
                          <span className="text-[10px] text-[#7A7973] font-mono">
                            {doc.pages} pages · {doc.size}
                          </span>
                        </div>

                        <p className="text-xs text-[#5C5B56] line-clamp-1 mt-0.5">
                          {doc.description || `Topic: ${doc.topicCategory}`}
                        </p>

                        <div className="flex items-center gap-2 mt-2 text-[11px] text-[#7A7973]">
                          <span>Added {doc.uploadedAt}</span>
                          <span>•</span>
                          <span className="text-cobalt-700 font-medium">{lastStudiedText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                      <button
                        onClick={() => toggleDocumentActive(doc.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${
                          isActiveInRAG
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-white text-[#5F6470] hover:text-[#1F242E] border-[#D4D2C9] hover:bg-[#F2F0E8]'
                        }`}
                        title="Toggle inclusion in search index"
                      >
                        {isActiveInRAG ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Active</span>
                          </>
                        ) : (
                          <span>Excluded</span>
                        )}
                      </button>

                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="p-1.5 text-[#737887] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors duration-150"
                        title="Remove Document from library"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-[#E7E5DF] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          toggleDocumentActive(doc.id);
                          navigateTo('workspace');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#5F6470] hover:text-[#1F242E] bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] rounded-lg transition-colors duration-150"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        <span>Ask Questions</span>
                      </button>

                      <button
                        onClick={() => navigateTo('quiz')}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#5F6470] hover:text-[#1F242E] bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] rounded-lg transition-colors duration-150"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Practice Quiz</span>
                      </button>
                    </div>

                    {/* Secondary Study Workspace Action */}
                    <button
                      onClick={() => openDocumentStudy(doc.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] border border-[#D4D2C9] hover:border-[#BDB9AC] text-xs font-semibold rounded-lg shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                    >
                      <span>Open Study Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#1F242E]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <DocumentUploadModal />
    </div>
  );
};
