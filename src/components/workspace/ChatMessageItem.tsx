import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SourceCitation, StructuredAnswerSection } from '../../types/chat';
import { VisualType, VisualSpec, VisualRecommendation } from '../../types/visual';
import { SpeechAudioState } from '../../types/speech';
import { CapabilityBadge } from '../common/CapabilityBadge';
import { VisualRenderer } from '../visual/VisualRenderer';
import { SpeechService } from '../../services/speechService';
import { VisualService } from '../../services/visualService';
import { useLearning } from '../../context/LearningContext';
import { 
  Database, 
  Lightbulb, 
  ExternalLink, 
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Loader2,
  RefreshCw,
  GitBranch,
  Network,
  Share2,
  BookOpen,
  FileText,
  Bookmark,
  Check,
  X,
  Info
} from 'lucide-react';

interface Props {
  message: ChatMessage;
  userQueryForSourceContext?: string;
  onSelectPrompt?: (prompt: string) => void;
}

export const ChatMessageItem: React.FC<Props> = ({ 
  message, 
  userQueryForSourceContext,
  onSelectPrompt 
}) => {
  const { inspectSource } = useLearning();
  const [showDebug, setShowDebug] = useState(false);

  // Audio / TTS state
  const [audioState, setAudioState] = useState<SpeechAudioState>('IDLE');
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Visual state
  const [showVisualPanel, setShowVisualPanel] = useState<boolean>(false);
  const [selectedVisualType, setSelectedVisualType] = useState<VisualType>('flowchart');
  const [visualState, setVisualState] = useState<'IDLE' | 'RECOMMENDING' | 'GENERATING' | 'GENERATED' | 'REFUSAL' | 'ERROR'>('IDLE');
  const [recommendation, setRecommendation] = useState<VisualRecommendation | null>(null);
  const [visualSpec, setVisualSpec] = useState<VisualSpec | null>(null);
  const [visualMessage, setVisualMessage] = useState<string | null>(null);

  // Interactive Quiz state (for quiz questions inside explanation)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});

  const isUser = message.role === 'user';
  const ans = message.structuredAnswer;

  // Cleanup audio object on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  // Pre-load visual recommendation if provided in answer
  useEffect(() => {
    if (ans?.recommendedVisual && !recommendation) {
      setRecommendation({
        recommendedType: ans.recommendedVisual.type,
        reason: ans.recommendedVisual.reason,
      });
      setSelectedVisualType(ans.recommendedVisual.type);
    }
  }, [ans]);

  if (isUser) {
    return (
      <div className="flex justify-end pt-2 pb-1 animate-slide-up">
        <div className="max-w-2xl bg-[#1A1A18] text-white px-4 py-3 rounded-2xl shadow-soft text-xs sm:text-sm font-medium leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // Strict RAG grounding check: only grounded if sources exist AND were retrieved
  const hasGroundedSources = Boolean(message.sources && message.sources.length > 0);
  const isInsufficientRetrieval = !hasGroundedSources;

  // Filter capabilities: never show RAG GROUNDED if 0 sources exist
  const displayCapabilities = (message.capabilities || []).filter(
    (cap) => cap !== 'RAG GROUNDED' || hasGroundedSources
  );

  // Extract pure learner-facing speech text (omits chunk IDs, metadata, trace, and raw citations)
  const getSpeechText = (): string => {
    if (ans) {
      if (ans.isGrounded === false) {
        return ans.shortAnswer || "I couldn't find enough information about this topic in your selected learning materials.";
      }
      const parts: string[] = [];
      if (ans.title) {
        parts.push(`${ans.title}.`);
      }
      if (ans.overview) {
        parts.push(ans.overview);
      } else if (ans.shortAnswer) {
        parts.push(ans.shortAnswer);
      }
      // Read key explanatory sections if overview is short
      if (ans.sections && ans.sections.length > 0) {
        for (const sec of ans.sections) {
          if (sec.type === 'paragraph' && sec.content) {
            parts.push(`${sec.heading}: ${sec.content}`);
          } else if (sec.type === 'callout' && sec.content) {
            parts.push(`${sec.heading}: ${sec.content}`);
          }
        }
      }
      if (ans.inSimpleTerms) {
        parts.push(`In simple terms: ${ans.inSimpleTerms}`);
      }
      if (ans.keyTakeaways && ans.keyTakeaways.length > 0) {
        parts.push(`Key takeaways: ${ans.keyTakeaways.join('. ')}`);
      }
      return parts.join(' ');
    }
    return message.content;
  };

  /**
   * Handle Audio Playback Toggle (Listen, Pause, Resume, Replay)
   */
  const handleListenToggle = async () => {
    setAudioError(null);

    // If currently playing, pause it
    if (audioState === 'PLAYING') {
      if (audioRef.current) {
        audioRef.current.pause();
        setAudioState('PAUSED');
      }
      return;
    }

    // If paused, resume
    if (audioState === 'PAUSED') {
      if (audioRef.current) {
        audioRef.current.play().catch((err) => {
          setAudioState('ERROR');
          setAudioError(`Audio playback error: ${err.message}`);
        });
        setAudioState('PLAYING');
      }
      return;
    }

    // If ended, replay
    if (audioState === 'ENDED') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          setAudioState('ERROR');
          setAudioError(`Audio playback error: ${err.message}`);
        });
        setAudioState('PLAYING');
      }
      return;
    }

    // If we already have the synthesized audio URL, play it
    if (audioUrlRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        setAudioState('ERROR');
        setAudioError(`Audio playback error: ${err.message}`);
      });
      setAudioState('PLAYING');
      return;
    }

    // Otherwise, request synthesis from real Azure Speech backend
    setAudioState('LOADING');
    try {
      const textToSpeak = getSpeechText();
      const result = await SpeechService.synthesize(textToSpeak);

      if (result.success && result.audioUrl) {
        audioUrlRef.current = result.audioUrl;
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setAudioState('ENDED');
        };

        audio.onerror = () => {
          setAudioState('ERROR');
          setAudioError('Failed to decode or play audio.');
        };

        await audio.play();
        setAudioState('PLAYING');
      }
    } catch (err: any) {
      setAudioState('ERROR');
      setAudioError(err.message || 'Speech synthesis failed. Please check Azure Speech configuration.');
    }
  };

  /**
   * Open Visual Explanation panel and get recommendation
   */
  const handleOpenVisualPanel = async () => {
    setShowVisualPanel(true);
    if (!recommendation && visualState === 'IDLE') {
      setVisualState('RECOMMENDING');
      try {
        const question = userQueryForSourceContext || message.content;
        const answerText = getSpeechText();
        const rec = await VisualService.recommendVisualType(question, answerText, message.sources || []);
        setRecommendation(rec);
        if (rec.recommendedType) {
          setSelectedVisualType(rec.recommendedType);
        }
        setVisualState('IDLE');
      } catch {
        setVisualState('IDLE');
      }
    }
  };

  /**
   * Request grounded visual generation from Azure backend
   */
  const handleGenerateVisual = async (targetType?: VisualType) => {
    const typeToGenerate = targetType || selectedVisualType;
    setSelectedVisualType(typeToGenerate);
    setVisualState('GENERATING');
    setVisualMessage(null);

    try {
      const question = userQueryForSourceContext || message.content;
      const answerText = getSpeechText();
      const result = await VisualService.generateVisual(
        question,
        answerText,
        typeToGenerate,
        message.sources || []
      );

      if (!result.isGrounded || !result.visual) {
        setVisualState('REFUSAL');
        setVisualMessage(
          result.message ||
            "I don't have enough information in your selected learning materials to generate a reliable visual for this topic."
        );
        return;
      }

      setVisualSpec(result.visual);
      setVisualState('GENERATED');
    } catch (err: any) {
      setVisualState('ERROR');
      setVisualMessage(err.message || 'Failed to generate visual explanation.');
    }
  };

  // Group sources by document for the scholarly sources layout
  const sourcesByDoc = (message.sources || []).reduce<Record<string, { docName: string; pages: number[]; citations: SourceCitation[] }>>(
    (acc, src) => {
      const key = src.documentId || src.documentName;
      if (!acc[key]) {
        acc[key] = { docName: src.documentName, pages: [], citations: [] };
      }
      if (!acc[key].pages.includes(src.page)) {
        acc[key].pages.push(src.page);
      }
      acc[key].citations.push(src);
      return acc;
    },
    {}
  );

  return (
    <div className="flex items-start gap-3.5 pb-2 animate-slide-up">
      {/* Academic Tutor Avatar */}
      <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 mt-1 font-serif text-xs font-bold shadow-soft">
        M
      </div>

      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft p-5 sm:p-6 space-y-5">
        {/* Header: Timestamp and Grounding Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F5F4EE]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-serif-display text-[#1A1A18] tracking-tight">
              Academic Tutor Explanation
            </span>
            <span className="text-[10px] text-[#A3A29B] font-mono">{message.timestamp}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {displayCapabilities.map((cap) => (
              <CapabilityBadge key={cap} capability={cap} size="sm" />
            ))}
          </div>
        </div>

        {/* Responsible AI: Insufficient Retrieval Scope Notice */}
        {isInsufficientRetrieval && (
          <div className="p-4 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF] flex items-start gap-3 text-xs text-[#5C5B56]">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#1A1A18]">Grounding Scope Notice</p>
              <p className="mt-0.5 text-[#5C5B56] leading-relaxed">
                I couldn't find enough verified information about this topic in your selected learning materials. To protect academic accuracy, grounded answers are limited strictly to uploaded course materials.
              </p>
            </div>
          </div>
        )}

        {/* 1. STRUCTURED ACADEMIC ANSWER SECTION */}
        <div className="space-y-4">
          {/* Action Bar: Audio Listen & Visualize */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
                {ans?.answerType ? ans.answerType.replace(/_/g, ' ') : 'Explanation'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* TTS Listen Button */}
              <button
                type="button"
                onClick={handleListenToggle}
                disabled={audioState === 'LOADING'}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 shadow-xs border ${
                  audioState === 'PLAYING'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : audioState === 'PAUSED'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : audioState === 'ENDED'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : audioState === 'LOADING'
                    ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-wait'
                    : 'bg-[#FAF9F5] hover:bg-[#F2F0E8] text-[#1F242E] border-[#D4D2C9]'
                }`}
                title="Listen to explanation with Azure Speech TTS"
              >
                {audioState === 'LOADING' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                )}
                {audioState === 'PLAYING' && (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                )}
                {audioState === 'PAUSED' && (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                )}
                {audioState === 'ENDED' && (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Replay</span>
                  </>
                )}
                {(audioState === 'IDLE' || audioState === 'ERROR') && (
                  <>
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Listen</span>
                  </>
                )}
              </button>

              {/* Visualize Button Trigger */}
              {!showVisualPanel && (
                <button
                  type="button"
                  onClick={handleOpenVisualPanel}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-[#1E3A8A] bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/80 transition-all duration-150 shadow-xs active:scale-95"
                  title="Generate structured visual explanation (Flowchart, Mind Map, Diagram)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Visualize</span>
                </button>
              )}
            </div>
          </div>

          {/* TTS Error Notice (concise, answer remains visible) */}
          {audioError && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
              <VolumeX className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>{audioError}</span>
            </div>
          )}

          {/* Grounded Refusal Notice */}
          {ans?.isGrounded === false && (
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 flex items-start gap-3 text-xs sm:text-sm text-amber-950">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block text-amber-900">Not Found in Selected Learning Material</span>
                <p className="leading-relaxed">
                  {ans.shortAnswer || "I couldn't find enough information about this topic in your selected learning materials."}
                </p>
                <p className="text-[11px] text-amber-800/80 pt-1">
                  Try selecting additional documents or asking about concepts covered in your active course materials.
                </p>
              </div>
            </div>
          )}

          {/* Answer Title */}
          {ans?.title && ans.isGrounded !== false && (
            <h3 className="text-base sm:text-lg font-serif-display font-bold text-[#1F242E] tracking-tight border-b border-[#F5F4EE] pb-2">
              {ans.title}
            </h3>
          )}

          {/* High-level Overview / Executive Summary */}
          {ans?.overview && ans.overview !== ans.title && ans.isGrounded !== false && (
            <p className="text-xs sm:text-sm font-medium text-[#2E3545] leading-relaxed bg-[#FAF9F5] p-3.5 rounded-xl border border-[#E7E5DF]">
              {ans.overview}
            </p>
          )}

          {/* Pedagogical Structured Sections */}
          {ans?.sections && ans.sections.length > 0 && ans.isGrounded !== false ? (
            <div className="space-y-4 pt-1">
              {ans.sections.map((sec: StructuredAnswerSection, sIdx: number) => {
                // Section: Paragraph
                if (sec.type === 'paragraph' && sec.content) {
                  return (
                    <div key={sIdx} className="space-y-1.5">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#5F6470]">
                        {sec.heading}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#1F242E] leading-relaxed">
                        {sec.content}
                      </p>
                    </div>
                  );
                }

                // Section: Numbered Steps
                if (sec.type === 'steps' && sec.items && sec.items.length > 0) {
                  return (
                    <div key={sIdx} className="space-y-2.5 pt-1">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#5F6470]">
                        {sec.heading}
                      </h4>
                      <div className="space-y-2 pl-0.5">
                        {sec.items.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-[#1F242E] p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E7E5DF]/70">
                            <span className="w-5 h-5 rounded-full bg-[#1E3A8A] text-white font-mono text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                              {idx + 1}
                            </span>
                            <p className="leading-relaxed flex-1 pt-0.5">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Section: Bullet Points
                if (sec.type === 'bullets' && sec.items && sec.items.length > 0) {
                  return (
                    <div key={sIdx} className="space-y-2 pt-1">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#5F6470]">
                        {sec.heading}
                      </h4>
                      <div className="space-y-1.5 pl-1">
                        {sec.items.map((bullet, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#1F242E]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1E3A8A] mt-2 flex-shrink-0" />
                            <span className="leading-relaxed">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Section: Comparison Table
                if (sec.type === 'table' && sec.table) {
                  return (
                    <div key={sIdx} className="space-y-2 pt-1">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#5F6470]">
                        {sec.heading}
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-[#E7E5DF] shadow-soft">
                        <table className="min-w-full divide-y divide-[#E7E5DF] text-xs text-left">
                          <thead className="bg-[#FAF9F5] text-[#3D3D3A] font-semibold font-serif-display">
                            <tr>
                              {sec.table.headers.map((h, hIdx) => (
                                <th key={hIdx} className="px-3 py-2.5">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#F5F4EE] bg-white font-sans">
                            {sec.table.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-[#FAF9F5] transition-colors">
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-3 py-2 text-[#1F242E] ${
                                      cIdx === 0 ? 'font-medium bg-[#FAF9F5]/30' : ''
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                // Section: Callout Boxes (Remember / Analogy / Info / Warning)
                if (sec.type === 'callout' && sec.content) {
                  const isRemember = sec.calloutType === 'remember';
                  const isAnalogy = sec.calloutType === 'analogy';
                  const isWarning = sec.calloutType === 'warning';

                  return (
                    <div
                      key={sIdx}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                        isRemember
                          ? 'bg-amber-50/70 border-amber-200/90 text-amber-950'
                          : isAnalogy
                          ? 'bg-blue-50/70 border-blue-200/90 text-blue-950'
                          : isWarning
                          ? 'bg-rose-50/70 border-rose-200/90 text-rose-950'
                          : 'bg-[#FAF9F5] border-[#E7E5DF] text-[#1F242E]'
                      }`}
                    >
                      {isRemember && <Bookmark className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                      {isAnalogy && <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
                      {isWarning && <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />}
                      {!isRemember && !isAnalogy && !isWarning && <Info className="w-4 h-4 text-[#1E3A8A] flex-shrink-0 mt-0.5" />}

                      <div className="space-y-0.5">
                        <span className="block font-mono text-[10px] font-bold uppercase tracking-wider opacity-80">
                          {sec.heading}
                        </span>
                        <p>{sec.content}</p>
                      </div>
                    </div>
                  );
                }

                // Section: Interactive Quiz Mode (only when student requested quiz)
                if (sec.type === 'quiz_interactive' && sec.quizQuestions && sec.quizQuestions.length > 0) {
                  return (
                    <div key={sIdx} className="space-y-3 pt-2">
                      <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#1E3A8A] flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {sec.heading}
                      </h4>
                      <div className="space-y-3">
                        {sec.quizQuestions.map((q, qIdx) => {
                          const chosen = selectedOptions[q.id];
                          const hasAnswered = chosen !== undefined;
                          const isCorrect = hasAnswered && chosen === q.correctAnswerIndex;

                          return (
                            <div key={q.id || qIdx} className="p-4 rounded-xl border border-[#D4D2C9] bg-[#FAF9F5] space-y-2.5">
                              <p className="text-xs sm:text-sm font-semibold text-[#1F242E]">
                                {qIdx + 1}. {q.question}
                              </p>
                              <div className="space-y-1.5">
                                {q.options.map((opt, optIdx) => {
                                  const isSelected = chosen === optIdx;
                                  const isOptionCorrect = hasAnswered && optIdx === q.correctAnswerIndex;
                                  const isOptionWrong = isSelected && !isCorrect;

                                  return (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      onClick={() => setSelectedOptions((prev) => ({ ...prev, [q.id]: optIdx }))}
                                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all duration-150 flex items-center justify-between ${
                                        isOptionCorrect
                                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium'
                                          : isOptionWrong
                                          ? 'bg-rose-50 border-rose-300 text-rose-950'
                                          : isSelected
                                          ? 'bg-white border-[#1E3A8A] text-[#1E3A8A] ring-1 ring-[#1E3A8A]'
                                          : 'bg-white hover:bg-[#F2F0E8] border-[#D4D2C9] text-[#1F242E]'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      {isOptionCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                                      {isOptionWrong && <X className="w-4 h-4 text-rose-600" />}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Explanation Reveal */}
                              {hasAnswered && q.explanation && (
                                <div className="p-2.5 rounded-lg bg-white border border-[#E7E5DF] text-xs text-[#5F6470] animate-in fade-in duration-150">
                                  <span className="font-semibold text-[#1F242E]">Explanation:</span> {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          ) : ans ? (
            /* Fallback Legacy Renderer (if sections array is absent) */
            <div className="text-xs sm:text-sm text-[#1A1A18] leading-relaxed font-sans space-y-4">
              {ans.shortAnswer && (
                <p className="text-sm font-medium text-[#1A1A18] leading-relaxed">
                  {ans.shortAnswer}
                </p>
              )}

              {/* Comparison Table */}
              {ans.keyDifferences && (
                <div className="space-y-2 pt-1">
                  <span className="block text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono">
                    Comparison
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-[#E7E5DF] shadow-soft">
                    <table className="min-w-full divide-y divide-[#E7E5DF] text-xs text-left">
                      <thead className="bg-[#FAF9F5] text-[#3D3D3A] font-semibold font-serif-display">
                        <tr>
                          <th className="px-3 py-2 w-1/4">Feature</th>
                          <th className="px-3 py-2 text-cobalt-800 bg-cobalt-50/40">{ans.keyDifferences.headerA}</th>
                          <th className="px-3 py-2 text-indigo-800 bg-indigo-50/40">{ans.keyDifferences.headerB}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F4EE] bg-white font-sans">
                        {ans.keyDifferences.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#FAF9F5] transition-colors">
                            <td className="px-3 py-2 font-medium text-[#1A1A18] bg-[#FAF9F5]/40">{row.feature}</td>
                            <td className="px-3 py-2 text-[#3D3D3A]">{row.colA}</td>
                            <td className="px-3 py-2 text-[#3D3D3A]">{row.colB}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step-by-Step Sequence */}
              {ans.stepByStep && (
                <div className="space-y-2 pt-1">
                  <span className="block text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono">
                    Sequence Breakdown
                  </span>
                  <div className="space-y-1.5 pl-1">
                    {ans.stepByStep.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-[#3D3D3A]">
                        <span className="w-4 h-4 rounded bg-[#F5F4EE] text-[#5C5B56] font-mono text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed flex-1">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bullet Points */}
              {ans.bulletPoints && (
                <div className="space-y-1.5 pt-1">
                  {ans.bulletPoints.map((bp, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#3D3D3A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cobalt-600 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{bp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* In Simple Terms Analogy */}
              {ans.inSimpleTerms && (
                <div className="p-3.5 bg-[#FAF9F5] rounded-xl border border-[#E7E5DF] flex items-start gap-3">
                  <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider font-mono mb-0.5">
                      Intuitive Analogy
                    </span>
                    <p className="text-xs text-[#5C5B56] leading-relaxed">{ans.inSimpleTerms}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-[#1A1A18] leading-relaxed font-sans">
              {message.content}
            </p>
          )}

          {/* Key Takeaways Highlight Cards */}
          {ans?.keyTakeaways && ans.keyTakeaways.length > 0 && (
            <div className="pt-2 border-t border-[#F5F4EE]">
              <span className="block text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono mb-1.5">
                Key Takeaways
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ans.keyTakeaways.map((takeaway, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E7E5DF] text-[11px] text-[#3D3D3A]">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>{takeaway}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. VISUAL EXPLANATION SECTION (Diagram / Flowchart / Mind Map) */}
        {showVisualPanel && (
          <div className="pt-4 border-t border-[#E7E5DF] space-y-3.5 bg-[#FAF9F5]/70 -mx-5 sm:-mx-6 px-5 sm:px-6 py-4 rounded-xl border-dashed">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-indigo-100 text-indigo-700">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold font-serif-display text-[#1A1A18] uppercase tracking-wide">
                  Visual Explanation
                </span>
              </div>

              {/* Format selection pills */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-[#D4D2C9]">
                <button
                  type="button"
                  onClick={() => { setSelectedVisualType('flowchart'); if (visualState === 'GENERATED') handleGenerateVisual('flowchart'); }}
                  disabled={visualState === 'GENERATING'}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedVisualType === 'flowchart'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8]'
                  }`}
                >
                  <GitBranch className="w-3 h-3" />
                  <span>Flowchart</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedVisualType('mindmap'); if (visualState === 'GENERATED') handleGenerateVisual('mindmap'); }}
                  disabled={visualState === 'GENERATING'}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedVisualType === 'mindmap'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8]'
                  }`}
                >
                  <Share2 className="w-3 h-3" />
                  <span>Mind map</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSelectedVisualType('diagram'); if (visualState === 'GENERATED') handleGenerateVisual('diagram'); }}
                  disabled={visualState === 'GENERATING'}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    selectedVisualType === 'diagram'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8]'
                  }`}
                >
                  <Network className="w-3 h-3" />
                  <span>Diagram</span>
                </button>
              </div>
            </div>

            {/* Recommendation Banner */}
            {recommendation && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold capitalize">Recommended: {recommendation.recommendedType}.</span>{' '}
                  <span>{recommendation.reason}</span>
                </div>
              </div>
            )}

            {/* Generation CTA Banner (Pre-generation) */}
            {visualState === 'IDLE' && !visualSpec && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-[#D4D2C9]">
                <div>
                  <p className="text-xs font-semibold text-[#1F242E]">
                    Generate grounded visual representation
                  </p>
                  <p className="text-[11px] text-[#5F6470] mt-0.5">
                    Structure synthesized strictly from your retrieved course material chunks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateVisual()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#152a65] text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate {selectedVisualType.charAt(0).toUpperCase() + selectedVisualType.slice(1)}</span>
                </button>
              </div>
            )}

            {/* Loading State */}
            {visualState === 'GENERATING' && (
              <div className="p-8 text-center bg-white rounded-xl border border-[#D4D2C9] space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#1E3A8A] mx-auto" />
                <p className="text-xs font-semibold text-[#1F242E]">
                  Synthesizing grounded {selectedVisualType} specification...
                </p>
                <p className="text-[11px] text-[#5F6470]">
                  Verifying structure against Azure AI Search chunk passages.
                </p>
              </div>
            )}

            {/* Refusal State: Insufficient Information */}
            {visualState === 'REFUSAL' && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Insufficient Material</p>
                  <p className="mt-0.5 leading-relaxed">{visualMessage}</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {visualState === 'ERROR' && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Visual Generation Failed</p>
                    <p className="mt-0.5 leading-relaxed">{visualMessage}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateVisual()}
                  className="px-2.5 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs flex-shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Rendered Visual Container */}
            {visualSpec && visualState === 'GENERATED' && (
              <div className="space-y-2">
                <VisualRenderer spec={visualSpec} />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateVisual()}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] rounded-md shadow-xs transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 text-[#5F6470]" />
                    <span>Regenerate</span>
                  </button>
                  <span className="text-[10px] text-[#737887]">
                    Rendered via responsive SVG vector engine
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SCHOLARLY SOURCES (Moved below explanation per specification) */}
        {hasGroundedSources && (
          <div className="pt-4 border-t border-[#E7E5DF] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-serif-display text-[#1F242E] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                Sources
              </span>
              <span className="text-[10px] text-[#737887] font-mono">
                {message.sources!.length} chunk{message.sources!.length === 1 ? '' : 's'} verified
              </span>
            </div>

            {/* Document Grouping: 📄 Document.pdf · Pages 25, 26 */}
            <div className="space-y-2">
              {Object.entries(sourcesByDoc).map(([docId, group]) => (
                <div key={docId} className="p-3 rounded-xl border border-[#D4D2C9] bg-[#FAF9F5] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#1E3A8A] flex-shrink-0" />
                      <span className="text-xs font-semibold text-[#1F242E] truncate">
                        {group.docName}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#5F6470] flex-shrink-0">
                      Pages {group.pages.sort((a, b) => a - b).join(', ')}
                    </span>
                  </div>

                  {/* Clickable chunk excerpt buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {group.citations.map((source, idx) => (
                      <button
                        key={source.id || idx}
                        type="button"
                        onClick={() => inspectSource(source, userQueryForSourceContext || message.content)}
                        className="flex items-start gap-2 p-2 rounded-lg bg-white hover:bg-[#F2F0E8] border border-[#E7E5DF] text-left transition-colors text-xs group"
                        title="Click to inspect chunk passage in grounding inspector"
                      >
                        <span className="text-[10px] font-mono font-bold text-[#1E3A8A] mt-0.5">
                          P.{source.page}
                        </span>
                        <p className="text-[11px] text-[#5F6470] group-hover:text-[#1F242E] line-clamp-1 flex-1">
                          {source.excerpt}
                        </p>
                        <ExternalLink className="w-3 h-3 text-[#737887] group-hover:text-[#1F242E] flex-shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. RAG DIAGNOSTIC TRACE */}
        {message.debugInfo && (
          <div className="pt-2 border-t border-[#E7E5DF]">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] px-2.5 py-1 rounded-lg transition-colors duration-150 border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              <Terminal className="w-3 h-3 text-[#1E3A8A]" />
              <span className="font-semibold">View retrieval details</span>
              <span className="text-[10px] text-[#737887]">({message.debugInfo.groundingDecision})</span>
              {showDebug ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </button>

            {showDebug && (
              <div className="mt-2 p-3.5 bg-[#1F242E] text-[#FAF9F5] rounded-xl font-mono text-[11px] space-y-2.5 border border-[#161B22] animate-slide-up shadow-elevated">
                <div className="flex items-center justify-between border-b border-[#334155] pb-1.5">
                  <span className="text-blue-300 font-bold">Azure AI Retrieval Metrics</span>
                  <span className={`px-2 py-0.2 rounded text-[10px] font-bold ${message.debugInfo.groundingDecision.includes('GROUNDED') ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                    {message.debugInfo.groundingDecision}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-[#A3A5AA]">Search Index:</span>{' '}
                    <span className="text-[#FAF9F5]">{message.debugInfo.searchIndex}</span>
                  </div>
                  <div>
                    <span className="text-[#A3A5AA]">Model Deployment:</span>{' '}
                    <span className="text-[#FAF9F5]">{message.debugInfo.model}</span>
                  </div>
                  <div>
                    <span className="text-[#A3A5AA]">Retrieved Chunks:</span>{' '}
                    <span className="text-[#FAF9F5]">{message.debugInfo.totalRetrieved}</span>
                  </div>
                  <div>
                    <span className="text-[#A3A5AA]">Source Pages:</span>{' '}
                    <span className="text-[#FAF9F5]">{message.debugInfo.retrievedPages?.join(', ') || 'N/A'}</span>
                  </div>
                </div>

                {message.debugInfo.scores && message.debugInfo.scores.length > 0 && (
                  <div className="pt-1.5 border-t border-[#334155]">
                    <span className="text-[10px] text-[#A3A5AA] block mb-1">Ranked Search Hits (RRF Score):</span>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {message.debugInfo.scores.map((sc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] bg-[#161B22] px-2 py-1 rounded">
                          <span className="text-[#DEDBD2] truncate max-w-[200px]">Chunk: {sc.chunkId}</span>
                          <span className="text-blue-300">Page {sc.pageNumber}</span>
                          <span className="text-emerald-400 font-semibold">{sc.score.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Suggested Follow-ups */}
        {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-[#5F6470] uppercase tracking-wider font-mono mr-1 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-[#1E3A8A]" />
              Follow-ups:
            </span>
            {message.suggestedFollowUps.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt && onSelectPrompt(suggestion)}
                className="px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] hover:border-[#BDB9AC] rounded-lg shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
