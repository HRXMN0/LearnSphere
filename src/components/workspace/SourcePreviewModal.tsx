import React from 'react';
import { Modal } from '../common/Modal';
import { useLearning } from '../../context/LearningContext';
import { Database, ArrowDown, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react';
import { CapabilityBadge } from '../common/CapabilityBadge';

export const SourcePreviewModal: React.FC = () => {
  const { 
    activeSourceForInspection, 
    activeQueryForInspection, 
    closeSourceInspection 
  } = useLearning();

  if (!activeSourceForInspection) return null;

  const relevancePct = Math.round(activeSourceForInspection.relevance * 100);

  return (
    <Modal
      isOpen={!!activeSourceForInspection}
      onClose={closeSourceInspection}
      title="Source Grounding Inspector"
      subtitle="Inspect the verified passage chunk retrieved from Azure AI Search."
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Step 1: User Query */}
        <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E7E5DF]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold tracking-wider text-[#7A7973] uppercase font-mono">
              1. Search Query
            </span>
            <span className="text-[10px] text-[#A3A29B] font-mono">1536-dim embedding</span>
          </div>
          <p className="text-sm font-semibold text-[#1A1A18] font-serif-display">
            "{activeQueryForInspection || 'Active Retrieval Query'}"
          </p>
        </div>

        {/* Transition */}
        <div className="flex justify-center text-[#7A7973]">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F4EE] text-[11px] font-medium text-[#5C5B56] border border-[#E7E5DF]">
            <ArrowDown className="w-3.5 h-3.5 text-cobalt-600" />
            <span>Azure AI Hybrid Search (RRF + Vector Cosine)</span>
          </div>
        </div>

        {/* Step 2: Retrieved Document Metadata & Relevance */}
        <div className="p-3.5 rounded-xl bg-cobalt-50/50 border border-cobalt-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-wider text-cobalt-800 uppercase font-mono flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-cobalt-600" />
              2. Retrieved Course Material Chunk
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono border border-emerald-300">
              {relevancePct}% Match Score
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1A18]">
            <BookOpen className="w-4 h-4 text-cobalt-600 flex-shrink-0" />
            <span className="truncate">{activeSourceForInspection.documentName}</span>
            <span className="text-[#A3A29B]">•</span>
            <span className="text-cobalt-800 font-bold font-mono">Page {activeSourceForInspection.page}</span>
          </div>
          <p className="text-[11px] text-[#5C5B56] mt-1 font-medium">
            Section: {activeSourceForInspection.section}
          </p>
        </div>

        {/* Step 3: Verifiable Excerpt Highlight */}
        <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold tracking-wider text-amber-900 uppercase font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              3. Retrieved Context Passage
            </span>
            <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
              Verified Textbook Excerpt
            </span>
          </div>
          <div className="relative pl-3 border-l-2 border-amber-400">
            <p className="text-xs text-[#1A1A18] leading-relaxed font-serif italic">
              "{activeSourceForInspection.excerpt}"
            </p>
          </div>
        </div>

        {/* Step 4: AI Formulation Connection */}
        <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-wider text-emerald-900 uppercase font-mono flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              4. Grounded Synthesis Output
            </span>
            <CapabilityBadge capability="RAG GROUNDED" size="sm" />
          </div>
          <p className="text-xs text-[#3D3D3A] leading-relaxed">
            The AI model used the extracted specifications, protocol headers, and verified guarantees from <strong>Page {activeSourceForInspection.page}</strong> to formulate the structured explanation without hallucination.
          </p>
        </div>

        {/* Close Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={closeSourceInspection}
            className="px-4 py-2 text-xs font-semibold text-[#1A1A18] bg-[#FAF9F5] hover:bg-[#F5F4EE] border border-[#E7E5DF] rounded-xl transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </Modal>
  );
};
