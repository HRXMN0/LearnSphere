import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useLearning } from '../../context/LearningContext';
import { 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Database, 
  Layers,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const DocumentUploadModal: React.FC = () => {
  const { 
    uploadDocumentModalOpen, 
    setUploadDocumentModalOpen, 
    uploadProgressStep, 
    uploadDocument 
  } = useLearning();

  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedStats, setCompletedStats] = useState<{
    name: string;
    pages: number;
    sections: number;
    diagrams: number;
    tables: number;
  } | null>(null);

  const handleStartUpload = async (fileInput: File | { name: string; size: string; type: string; fileObj?: File }) => {
    const isReal = fileInput instanceof File || (fileInput as any).fileObj instanceof File;
    const name = fileInput.name;
    const size = typeof (fileInput as any).size === 'number'
      ? `${((fileInput as any).size / (1024 * 1024)).toFixed(1)} MB`
      : String((fileInput as any).size || '1.5 MB');
    const type = fileInput.type || 'application/pdf';

    setSelectedFile({
      name,
      size,
      type,
    });
    setIsProcessing(true);
    setErrorMessage(null);
    setCompletedStats(null);

    try {
      const doc = await uploadDocument(fileInput);
      setIsProcessing(false);
      setCompletedStats({
        name: doc?.name || name,
        pages: doc?.pages || 1,
        sections: doc?.sectionsCount || Math.ceil((doc?.pages || 1) / 3),
        diagrams: doc?.diagramsCount || 0,
        tables: doc?.tablesCount || 0
      });
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Something went wrong while processing this document. Please check service status or try uploading again.');
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setUploadDocumentModalOpen(false);
      setSelectedFile(null);
      setCompletedStats(null);
      setErrorMessage(null);
    }
  };

  return (
    <Modal
      isOpen={uploadDocumentModalOpen}
      onClose={handleClose}
      title="Add Learning Material"
      subtitle="Your files stay in your learning workspace and power grounded AI answers."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {!isProcessing && !completedStats && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-rose-900">Upload & Processing Notice</p>
                  <p className="mt-0.5 text-rose-700 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Drag & drop zone */}
            <div className="border-2 border-dashed border-[#D4D2C9] hover:border-[#1F242E] bg-[#FAF9F5] hover:bg-[#F2F0E8] rounded-2xl p-8 text-center transition-all cursor-pointer relative group">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const f = e.target.files[0];
                    handleStartUpload(f);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="w-12 h-12 rounded-xl bg-white border border-[#D4D2C9] text-[#1E3A8A] flex items-center justify-center mx-auto mb-3 shadow-xs group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1F242E] font-serif-display">
                Drop your study material here
              </p>
              <p className="text-xs text-[#5F6470] mt-1">
                Supported: PDF · Notes · Images · Markdown (up to 45MB)
              </p>
              <p className="text-[11px] text-[#737887] mt-2 font-mono">
                Your files stay in your learning workspace.
              </p>
            </div>

            {/* Demo Curriculum Upload Shortcuts */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider block mb-2 font-mono">
                Or simulate university course materials:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleStartUpload({
                    name: 'Unit 4 — Network Layer & Routing.pdf',
                    size: '5.4 MB',
                    type: 'pdf'
                  })}
                  className="p-3 rounded-xl border border-[#D4D2C9] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-left transition-all flex items-center gap-2.5 text-xs text-[#1F242E] focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
                >
                  <FileText className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                  <span className="truncate font-medium">Unit 4 — Routing.pdf</span>
                </button>
                <button
                  onClick={() => handleStartUpload({
                    name: 'DNS & Application Protocols.pdf',
                    size: '3.1 MB',
                    type: 'pdf'
                  })}
                  className="p-3 rounded-xl border border-[#D4D2C9] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-left transition-all flex items-center gap-2.5 text-xs text-[#1F242E] focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
                >
                  <FileText className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                  <span className="truncate font-medium">DNS & Protocols.pdf</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Processing State: Multi-step timeline */}
        {isProcessing && uploadProgressStep && (
          <div className="py-6 px-4 bg-[#FAF9F5] rounded-2xl border border-[#E7E5DF] space-y-5 animate-slide-up">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7E5DF] text-cobalt-600 flex items-center justify-center mx-auto mb-2 shadow-soft animate-pulse">
                <Database className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#1A1A18] font-serif-display">
                {uploadProgressStep.label}
              </h4>
              <p className="text-xs text-[#7A7973] mt-0.5">
                Processing {selectedFile?.name} ({selectedFile?.size})
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-[#5C5B56] font-mono">
                <span>Ingestion Progress</span>
                <span>{uploadProgressStep.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#EBE9E1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-cobalt-600 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgressStep.progress}%` }}
                />
              </div>
            </div>

            {/* Processing Timeline Checklist */}
            <div className="grid grid-cols-1 gap-2 pt-2 text-xs text-[#5C5B56]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Uploaded</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${uploadProgressStep.progress >= 45 ? 'text-emerald-600' : 'text-[#DEDBD2]'}`} />
                <span>Text extracted & page boundaries preserved</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${uploadProgressStep.progress >= 70 ? 'text-emerald-600' : 'text-[#DEDBD2]'}`} />
                <span>Content indexed into Azure AI Search</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full mx-1 ${uploadProgressStep.progress >= 90 ? 'bg-emerald-500 animate-pulse' : 'bg-[#DEDBD2]'}`} />
                <span>Ready for grounded learning</span>
              </div>
            </div>
          </div>
        )}

        {/* Completed State */}
        {completedStats && (
          <div className="py-4 space-y-4 animate-slide-up">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-950 font-serif-display">
                  Your material is ready for study.
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Indexed into active Azure AI Search memory. Ready for grounded questions and practice.
                </p>
              </div>
            </div>

            {/* Document metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF]">
                <p className="text-[10px] text-[#7A7973] font-bold uppercase font-mono">Pages</p>
                <p className="text-base font-bold text-[#1A1A18] font-mono">{completedStats.pages}</p>
              </div>
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF]">
                <p className="text-[10px] text-[#7A7973] font-bold uppercase font-mono">Sections</p>
                <p className="text-base font-bold text-[#1A1A18] font-mono">{completedStats.sections}</p>
              </div>
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF]">
                <p className="text-[10px] text-[#7A7973] font-bold uppercase font-mono">Diagrams</p>
                <p className="text-base font-bold text-[#1A1A18] font-mono">{completedStats.diagrams}</p>
              </div>
              <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF]">
                <p className="text-[10px] text-[#7A7973] font-bold uppercase font-mono">Tables</p>
                <p className="text-base font-bold text-[#1A1A18] font-mono">{completedStats.tables}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium rounded-xl border border-[#161B22] shadow-sm transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
              >
                <span>Ready to Ask Questions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
