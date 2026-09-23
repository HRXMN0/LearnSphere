import React, { useState } from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { CapabilityBadge } from '../common/CapabilityBadge';
import { 
  Eye, 
  UploadCloud, 
  Sparkles, 
  PlusCircle, 
  HelpCircle, 
  Tag, 
  Layers,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileImage,
  Database,
  MessageSquareQuote,
  X
} from 'lucide-react';

export const VisionView: React.FC = () => {
  const { 
    visionAnalysis,
    visionState,
    visionError,
    currentVisionImage,
    isVisionAnalyzing,
    isVisionIndexing,
    isVisionIndexed,
    analyzeVisionImage,
    askVisionQuestion,
    addVisionToKnowledgeBase,
    loadVisionDemo,
    clearVision,
    askQuestion
  } = useLearning();

  const { navigateTo } = useApp();

  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isAnsweringQuestion, setIsAnsweringQuestion] = useState(false);
  const [imageQaAnswers, setImageQaAnswers] = useState<Array<{ question: string; answer: string }>>([]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      analyzeVisionImage({ name: file.name, fileObj: file });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      analyzeVisionImage({ name: file.name, fileObj: file });
    }
  };

  const handleAskAboutDiagram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customQuestion.trim() || isAnsweringQuestion) return;

    const q = customQuestion.trim();
    setCustomQuestion('');
    setIsAnsweringQuestion(true);

    try {
      const answer = await askVisionQuestion(q);
      setImageQaAnswers(prev => [{ question: q, answer }, ...prev]);
    } catch (err: any) {
      setImageQaAnswers(prev => [
        { question: q, answer: `Could not answer question: ${err.message || 'Vision model error'}` },
        ...prev
      ]);
    } finally {
      setIsAnsweringQuestion(false);
    }
  };

  const handleExplainSimply = () => {
    askQuestion(`Explain the ${visionAnalysis?.title || 'diagram'} simply with an everyday analogy.`);
    navigateTo('workspace');
  };

  const handleExplainTechnically = () => {
    askQuestion(`Provide a detailed technical breakdown of the ${visionAnalysis?.title || 'diagram'}, including protocol headers, flags, and failure recovery.`);
    navigateTo('workspace');
  };

  const handleGenerateQuizFromVision = () => {
    navigateTo('quiz');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5] select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E0DED7]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-indigo-50 text-[#1E3A8A]">
                <Eye className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-[#1F242E] tracking-tight">
                Understand an image
              </h1>
              <CapabilityBadge capability="VISION" size="sm" />
            </div>
            <p className="text-xs sm:text-sm text-[#5F6470]">
              Upload diagrams, lecture slides, handwritten notes, or architectural charts for real multimodal visual analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {visionAnalysis && (
              <button
                onClick={clearVision}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5F6470] hover:text-[#1F242E] bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] rounded-xl transition-all"
                title="Clear current visual analysis"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Visual</span>
              </button>
            )}

            <button
              onClick={loadVisionDemo}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] hover:border-[#BDB9AC] rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
              title="Load explicit TCP Handshake example diagram"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Load Example</span>
            </button>
          </div>
        </div>

        {/* State: ERROR */}
        {visionState === 'ERROR' && (
          <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-950 font-serif-display">Vision Analysis Failed</h4>
                <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                  {visionError || 'Azure AI could not analyze this image. Please ensure the file is an accessible image format (PNG, JPG, WEBP).'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1 pl-8">
              {currentVisionImage?.fileObj && (
                <button
                  onClick={() => analyzeVisionImage({ name: currentVisionImage.name, fileObj: currentVisionImage.fileObj })}
                  className="px-4 py-2 bg-[#1F242E] text-white text-xs font-medium rounded-xl hover:bg-[#2E3545] transition-all"
                >
                  Try Again
                </button>
              )}
              <button
                onClick={clearVision}
                className="px-4 py-2 bg-white text-[#1F242E] border border-[#D4D2C9] text-xs font-medium rounded-xl hover:bg-[#F2F0E8] transition-all"
              >
                Upload Different Image
              </button>
            </div>
          </div>
        )}

        {/* State: ANALYZING (Subtle Loading Banner) */}
        {visionState === 'ANALYZING' && (
          <div className="p-8 bg-white rounded-2xl border border-[#D4D2C9] shadow-soft text-center space-y-4 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-[#F2F0E8] border border-[#D4D2C9] text-[#1E3A8A] flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-display text-[#1F242E]">
                Analyzing your image with Azure OpenAI Vision...
              </h3>
              <p className="text-xs text-[#5F6470] mt-1 font-mono">
                {currentVisionImage?.name} ({currentVisionImage?.size || 'Processing'})
              </p>
              <p className="text-xs text-[#737887] mt-2 max-w-md mx-auto">
                Extracting technical diagram components, visual sequence flow, key architectural labels, and structured explanation.
              </p>
            </div>
          </div>
        )}

        {/* Drop & Upload Area (Visible when empty or as a replacement zone) */}
        {visionState !== 'ANALYZING' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="relative border-2 border-dashed border-[#D4D2C9] hover:border-[#1F242E] bg-white hover:bg-[#FAF9F5] rounded-2xl p-6 text-center transition-all group cursor-pointer shadow-xs"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Drop an image here or browse files"
            />
            <div className="w-11 h-11 rounded-xl bg-[#F2F0E8] border border-[#D4D2C9] text-[#1E3A8A] flex items-center justify-center mx-auto mb-2.5 shadow-xs group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-[#1F242E] font-serif-display">
              Drop diagram or handwritten note here, or <span className="text-[#1E3A8A] underline font-medium">browse files</span>
            </p>
            <p className="text-xs text-[#5F6470] mt-1 font-mono">
              Supports PNG · JPG · WEBP (processed with live Azure multimodal model)
            </p>
          </div>
        )}

        {/* Main Split View: Left Diagram Canvas, Right AI Interpretation */}
        {visionState === 'ANALYZED' && visionAnalysis && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: Diagram Visual Canvas Preview */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-[#D4D2C9] shadow-soft overflow-hidden flex flex-col">
              {/* Diagram Toolbar with real metadata */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0DED7] bg-[#FAF9F5]">
                <div className="flex items-center gap-2 truncate min-w-0">
                  <FileImage className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                  <span className="text-xs font-semibold text-[#1F242E] truncate" title={currentVisionImage?.name || visionAnalysis.title}>
                    {currentVisionImage?.name || visionAnalysis.title}
                  </span>
                  {visionAnalysis.isDemo ? (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-100 text-amber-900 border border-amber-300 flex-shrink-0">
                      EXAMPLE / DEMO
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-[#F2F0E8] text-[#1F242E] border border-[#D4D2C9] flex-shrink-0">
                      USER UPLOAD
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#5F6470] flex-shrink-0">
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.15))}
                    className="p-1.5 hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded text-[#1F242E] transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px] w-12 text-center text-[#1F242E]">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(1.75, z + 0.15))}
                    className="p-1.5 hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded text-[#1F242E] transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded text-[#1F242E] transition-colors"
                    title="Reset zoom"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Technical Canvas Preview: ACTUAL uploaded image or explicit Demo SVG */}
              <div className="p-6 flex items-center justify-center bg-[#FAF9F5]/40 min-h-[420px] overflow-auto">
                <div 
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  className="transition-transform duration-200 flex items-center justify-center w-full"
                >
                  {visionAnalysis.isDemo ? (
                    /* Explicit TCP Demo SVG */
                    <svg
                      viewBox="0 0 540 400"
                      className="w-full h-auto max-w-lg select-none drop-shadow-xs"
                      aria-label="TCP Three-Way Handshake diagram"
                    >
                      <defs>
                        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563eb" />
                        </marker>
                        <marker id="arrow-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
                        </marker>
                        <marker id="arrow-indigo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5" />
                        </marker>
                      </defs>

                      <rect x="50" y="20" width="130" height="40" rx="8" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
                      <text x="115" y="45" textAnchor="middle" fill="#1e3a8a" fontSize="13" fontWeight="bold">CLIENT (Initiator)</text>
                      <line x1="115" y1="60" x2="115" y2="370" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />

                      <rect x="360" y="20" width="130" height="40" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="2" />
                      <text x="425" y="45" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="bold">SERVER (Listener)</text>
                      <line x1="425" y1="60" x2="425" y2="370" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />

                      <text x="50" y="90" fill="#64748b" fontSize="11" fontStyle="italic">CLOSED</text>
                      <text x="440" y="90" fill="#64748b" fontSize="11" fontStyle="italic">LISTEN</text>

                      {/* Step 1 */}
                      <g 
                        onMouseEnter={() => setHoveredStep(1)} 
                        onMouseLeave={() => setHoveredStep(null)}
                        className="cursor-pointer transition-opacity"
                        opacity={hoveredStep === null || hoveredStep === 1 ? 1 : 0.35}
                      >
                        <rect x="90" y="105" width="360" height="44" rx="8" fill={hoveredStep === 1 ? '#dbeafe' : '#FAF9F5'} stroke="#bfdbfe" strokeWidth="1" />
                        <line x1="115" y1="120" x2="420" y2="150" stroke="#2563eb" strokeWidth="2.5" markerEnd="url(#arrow-blue)" />
                        <text x="270" y="122" textAnchor="middle" fill="#1e40af" fontSize="12" fontWeight="bold">
                          1. SYN (Seq = 1000, SYN=1, ACK=0)
                        </text>
                        <text x="270" y="138" textAnchor="middle" fill="#64748b" fontSize="10">
                          Client requests synchronized connection
                        </text>
                      </g>
                      <text x="40" y="145" fill="#2563eb" fontSize="10" fontWeight="bold">SYN_SENT</text>

                      {/* Step 2 */}
                      <g 
                        onMouseEnter={() => setHoveredStep(2)} 
                        onMouseLeave={() => setHoveredStep(null)}
                        className="cursor-pointer transition-opacity"
                        opacity={hoveredStep === null || hoveredStep === 2 ? 1 : 0.35}
                      >
                        <rect x="90" y="180" width="360" height="44" rx="8" fill={hoveredStep === 2 ? '#dcfce7' : '#FAF9F5'} stroke="#bbf7d0" strokeWidth="1" />
                        <line x1="425" y1="195" x2="120" y2="225" stroke="#059669" strokeWidth="2.5" markerEnd="url(#arrow-emerald)" />
                        <text x="270" y="196" textAnchor="middle" fill="#065f46" fontSize="12" fontWeight="bold">
                          2. SYN-ACK (Seq = 5000, Ack = 1001, SYN=1, ACK=1)
                        </text>
                        <text x="270" y="212" textAnchor="middle" fill="#64748b" fontSize="10">
                          Server confirms client ISN & offers server ISN
                        </text>
                      </g>
                      <text x="440" y="185" fill="#059669" fontSize="10" fontWeight="bold">SYN_RCVD</text>

                      {/* Step 3 */}
                      <g 
                        onMouseEnter={() => setHoveredStep(3)} 
                        onMouseLeave={() => setHoveredStep(null)}
                        className="cursor-pointer transition-opacity"
                        opacity={hoveredStep === null || hoveredStep === 3 ? 1 : 0.35}
                      >
                        <rect x="90" y="255" width="360" height="44" rx="8" fill={hoveredStep === 3 ? '#e0e7ff' : '#FAF9F5'} stroke="#c7d2fe" strokeWidth="1" />
                        <line x1="115" y1="270" x2="420" y2="300" stroke="#4f46e5" strokeWidth="2.5" markerEnd="url(#arrow-indigo)" />
                        <text x="270" y="271" textAnchor="middle" fill="#3730a3" fontSize="12" fontWeight="bold">
                          3. ACK (Seq = 1001, Ack = 5001, ACK=1, SYN=0)
                        </text>
                        <text x="270" y="287" textAnchor="middle" fill="#64748b" fontSize="10">
                          Client finalizes handshake (Data transfer permitted)
                        </text>
                      </g>

                      <rect x="50" y="325" width="130" height="30" rx="6" fill="#f1f5f9" stroke="#cbd5e1" />
                      <text x="115" y="344" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">ESTABLISHED</text>

                      <rect x="360" y="325" width="130" height="30" rx="6" fill="#f1f5f9" stroke="#cbd5e1" />
                      <text x="425" y="344" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="bold">ESTABLISHED</text>
                    </svg>
                  ) : (
                    /* Actual User Uploaded Image */
                    <div className="p-2 w-full flex items-center justify-center">
                      <img
                        src={currentVisionImage?.previewUrl || visionAnalysis.imageUrl}
                        alt={visionAnalysis.title || currentVisionImage?.name || 'Uploaded diagram'}
                        className="max-w-full max-h-[500px] object-contain rounded-xl shadow-xs border border-[#E0DED7] bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Grounding / Indexing Action (Clearly Separating Vision from RAG) */}
              <div className="p-4 border-t border-[#E0DED7] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <p className="text-xs font-semibold text-[#1F242E]">Optional: Add to Knowledge Base</p>
                  </div>
                  <p className="text-[11px] text-[#5F6470] mt-0.5">
                    Generates 1536-dim embedding and stores visual analysis in Azure AI Search.
                  </p>
                </div>

                <div>
                  {isVisionIndexed ? (
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>✓ Added to Knowledge Base</span>
                    </div>
                  ) : isVisionIndexing ? (
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F2F0E8] border border-[#D4D2C9] text-[#1F242E] text-xs font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-[#1E3A8A]" />
                      <span>Indexing in Azure AI Search...</span>
                    </div>
                  ) : (
                    <button
                      onClick={addVisionToKnowledgeBase}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium border border-[#161B22] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add to Knowledge Base</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: AI Interpretation Panel */}
            <div className="lg:col-span-6 space-y-4">
              {/* Card 1: What I See & Detected Elements */}
              <div className="bg-white rounded-2xl border border-[#D4D2C9] p-5 sm:p-6 shadow-soft space-y-4">
                <div className="flex items-center justify-between border-b border-[#E0DED7] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#1E3A8A]" />
                    <h3 className="text-sm font-bold font-serif-display text-[#1F242E]">
                      AI Interpretation
                    </h3>
                  </div>
                  <CapabilityBadge capability="VISION" size="sm" />
                </div>

                {/* Explanation */}
                <div>
                  <span className="block text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono mb-1">
                    Visual Explanation
                  </span>
                  <p className="text-xs sm:text-sm text-[#1F242E] leading-relaxed">
                    {visionAnalysis.whatISee}
                  </p>
                </div>

                {/* Detected Elements Tags */}
                <div>
                  <span className="block text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono mb-2">
                    Detected Elements ({visionAnalysis.keyConcepts.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {visionAnalysis.keyConcepts.map((concept, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs font-medium bg-[#F2F0E8] text-[#1F242E] rounded-lg border border-[#D4D2C9]"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Actions: Explain Simply, Technically, Generate Quiz */}
                <div className="pt-2 border-t border-[#E0DED7] flex flex-wrap gap-2">
                  <button
                    onClick={handleExplainSimply}
                    className="px-3.5 py-2 bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] text-xs font-medium rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
                  >
                    Explain simply
                  </button>
                  <button
                    onClick={handleExplainTechnically}
                    className="px-3.5 py-2 bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] text-xs font-medium rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
                  >
                    Explain technically
                  </button>
                  <button
                    onClick={handleGenerateQuizFromVision}
                    className="px-3.5 py-2 bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] text-xs font-medium rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20 flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>Generate quiz</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Step-by-Step Sequence (Dynamic or Empty Message) */}
              <div className="bg-white rounded-2xl border border-[#D4D2C9] p-5 sm:p-6 shadow-soft space-y-3">
                <span className="block text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
                  Step-by-Step Sequence Breakdown
                </span>

                {visionAnalysis.stepByStep && visionAnalysis.stepByStep.length > 0 ? (
                  <div className="space-y-2">
                    {visionAnalysis.stepByStep.map((step) => (
                      <div
                        key={step.stepNumber}
                        onMouseEnter={() => setHoveredStep(step.stepNumber)}
                        onMouseLeave={() => setHoveredStep(null)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          hoveredStep === step.stepNumber
                            ? 'bg-[#F2F0E8] border-[#1F242E] ring-1 ring-[#1F242E]/20'
                            : 'bg-[#FAF9F5] border-[#E0DED7] hover:bg-[#F2F0E8]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#1F242E]">
                            {step.title}
                          </span>
                          {step.senderReceiver && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#D4D2C9] rounded text-[#5F6470]">
                              {step.senderReceiver}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5F6470] leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5F6470] italic p-3 bg-[#FAF9F5] rounded-xl border border-[#E0DED7]">
                    No sequential process detected in this visual. This visual presents structural or conceptual information.
                  </p>
                )}
              </div>

              {/* Card 3: Important Labels */}
              <div className="bg-white rounded-2xl border border-[#D4D2C9] p-5 shadow-soft space-y-2.5">
                <span className="block text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
                  Important Labels & Components ({visionAnalysis.importantLabels?.length || 0})
                </span>
                {visionAnalysis.importantLabels && visionAnalysis.importantLabels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visionAnalysis.importantLabels.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-[#FAF9F5] rounded-xl border border-[#E0DED7] text-xs">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Tag className="w-3 h-3 text-[#1E3A8A]" />
                          <span className="font-semibold text-[#1F242E]">{item.tag}</span>
                        </div>
                        <p className="text-[11px] text-[#5F6470]">{item.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5F6470] italic p-2 bg-[#FAF9F5] rounded-xl border border-[#E0DED7]">
                    No explicit textual annotations or labels detected.
                  </p>
                )}
              </div>

              {/* Card 4: Interactive Image Q&A (100% Real Multimodal with this Image) */}
              <div className="bg-white rounded-2xl border border-[#D4D2C9] p-5 shadow-soft space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquareQuote className="w-4 h-4 text-[#1E3A8A]" />
                    <h4 className="text-xs font-bold text-[#1F242E] uppercase font-mono tracking-wider">
                      Ask about this image
                    </h4>
                  </div>
                  <span className="text-[10px] text-[#737887] font-mono">Multimodal GPT-4.1-mini</span>
                </div>

                <form onSubmit={handleAskAboutDiagram} className="flex gap-2">
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="Ask anything about what is shown in this visual..."
                    className="flex-1 px-3.5 py-2.5 text-xs bg-[#FAF9F5] border border-[#D4D2C9] rounded-xl focus:outline-none focus:bg-white focus:border-[#1F242E] text-[#1F242E] placeholder:text-[#A3A5AA]"
                  />
                  <button
                    type="submit"
                    disabled={!customQuestion.trim() || isAnsweringQuestion}
                    className="px-4 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] disabled:bg-[#FAF9F5] disabled:text-[#A3A5AA] disabled:border-[#D4D2C9] border border-[#161B22] text-white text-xs font-medium rounded-xl transition-all shadow-sm flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
                  >
                    {isAnsweringQuestion ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Ask</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Real Q&A History */}
                {imageQaAnswers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#E0DED7]">
                    {imageQaAnswers.map((qa, index) => (
                      <div key={index} className="p-3 bg-[#FAF9F5] border border-[#D4D2C9] rounded-xl space-y-1.5">
                        <p className="text-xs font-semibold text-[#1F242E]">
                          Q: {qa.question}
                        </p>
                        <p className="text-xs text-[#1F242E] leading-relaxed pl-2 border-l-2 border-[#1E3A8A]">
                          {qa.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
