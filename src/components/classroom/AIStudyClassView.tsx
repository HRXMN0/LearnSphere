import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GraduationCap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  FileCode,
  Paperclip,
  Check,
  Send,
  HelpCircle,
  Layers,
  ArrowRight,
  Radio,
  MessageCircle,
  User,
} from 'lucide-react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { AIClassAPI } from '../../services/aiClassService';
import { VisualService } from '../../services/visualService';
import { AIClassSession, ClassStartupState, TeachingBlock, UnderstandingCheck } from '../../types/aiClass';
import { VisualSpec } from '../../types/visual';
import { VisualRenderer } from '../visual/VisualRenderer';

export const AIStudyClassView: React.FC = () => {
  const { documents, activeDocumentIds } = useLearning();
  const { navigateTo, addToast } = useApp();

  // Classroom Session State
  const defaultDoc = documents.find((d) => activeDocumentIds.includes(d.id)) || documents[0];
  const [selectedDocId, setSelectedDocId] = useState<string>(defaultDoc ? defaultDoc.id : '');
  const [session, setSession] = useState<AIClassSession | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isClassStarted, setIsClassStarted] = useState<boolean>(false);
  const [startupState, setStartupState] = useState<ClassStartupState>('READY');
  const [startupError, setStartupError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Telemetry Timers for Startup & Playback Tracking
  const startupTimersRef = useRef<{
    startClicked: number;
    sessionActivated?: number;
    classroomRendered?: number;
    firstSearchCompleted?: number;
    firstLLMCompleted?: number;
    firstTTSCompleted?: number;
    firstAudioPlayback?: number;
  }>({ startClicked: 0 });

  // Audio Playback State
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [isTeacherSpeaking, setIsTeacherSpeaking] = useState<boolean>(false);
  const isTeacherSpeakingRef = useRef<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Teacher Speech & States
  const [currentSpeechText, setCurrentSpeechText] = useState<string>('');
  const currentSpeechTextRef = useRef<string>('');
  const [teacherState, setTeacherState] = useState<'TEACHING' | 'LISTENING' | 'THINKING' | 'PAUSED'>('LISTENING');

  // Microphone & Continuous Listening
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const isMicMutedRef = useRef<boolean>(false);
  const [isMicInitializing, setIsMicInitializing] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isStudentSpeaking, setIsStudentSpeaking] = useState<boolean>(false);
  const [micAvailable, setMicAvailable] = useState<boolean>(true);
  const speechRecognitionRef = useRef<any>(null);

  // Auto-Progression Pacing Timer (between teaching steps)
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Student Input & Conversation Transcript
  const [textInput, setTextInput] = useState<string>('');
  const [isProcessingQuestion, setIsProcessingQuestion] = useState<boolean>(false);
  const [conversationLog, setConversationLog] = useState<Array<{ role: 'teacher' | 'student'; text: string; timestamp: string }>>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  // Understanding Check & UI panels
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isEvaluatingCheck, setIsEvaluatingCheck] = useState<boolean>(false);
  const [showNotesDrawer, setShowNotesDrawer] = useState<boolean>(false);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState<boolean>(false);

  // Keep refs synchronized for async recognition handlers
  useEffect(() => {
    isTeacherSpeakingRef.current = isTeacherSpeaking;
  }, [isTeacherSpeaking]);

  useEffect(() => {
    currentSpeechTextRef.current = currentSpeechText;
  }, [currentSpeechText]);

  useEffect(() => {
    isMicMutedRef.current = isMicMuted;
  }, [isMicMuted]);

  // 1. Initialize Class Session on Document Selection (Does NOT auto-start lecture)
  useEffect(() => {
    if (selectedDocId) {
      loadOrCreateSession(selectedDocId);
    }
  }, [selectedDocId]);

  const loadOrCreateSession = async (docId: string) => {
    setIsInitializing(true);
    try {
      const newClass = await AIClassAPI.createClass(docId);
      setSession(newClass);
      setIsClassStarted(false);
      setElapsedSeconds(0);
      setAudioError(null);
    } catch {
      addToast('Failed to initialize classroom session.', 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  // 2. Timer: Counts elapsed duration only while class is actively running
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isClassStarted && session && session.state !== 'COMPLETED' && session.state !== 'PAUSED' && teacherState !== 'PAUSED') {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isClassStarted, session?.state, teacherState]);

  // 3. Reliable Audio Playback Engine
  const playTeacherVoice = useCallback((url: string) => {
    setAudioError(null);
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
    }
    const audio = audioPlayerRef.current;
    audio.pause();
    audio.src = url;
    setActiveAudioUrl(url);

    setIsTeacherSpeaking(true);
    setTeacherState('TEACHING');

    // Cancel any ongoing auto-progression countdown
    clearAutoAdvanceTimer();

    audio.onplay = () => {
      if (startupTimersRef.current.startClicked && !startupTimersRef.current.firstAudioPlayback) {
        const tAudio = Math.round(performance.now() - startupTimersRef.current.startClicked);
        startupTimersRef.current.firstAudioPlayback = tAudio;
        console.log(`[AI CLASS] first audio playback: ${tAudio}ms`);
      }
    };

    audio.onended = () => {
      setIsTeacherSpeaking(false);
      setTeacherState('LISTENING');
      // Trigger continuous teaching pause / listener
      scheduleAutoProgression();
    };

    audio.onerror = (err) => {
      console.warn('[Class Audio Playback Error]', err);
      setIsTeacherSpeaking(false);
      setTeacherState('LISTENING');
      setAudioError('Teacher audio could not be played.');
    };

    audio.play().catch((playErr) => {
      console.warn('[Audio Play Promise Rejected]', playErr);
      setIsTeacherSpeaking(false);
      setTeacherState('LISTENING');
      setAudioError('Click "Retry Audio" to allow sound playback.');
    });
  }, []);

  // 4. Natural Pacing between teaching steps
  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  };

  const scheduleAutoProgression = useCallback(() => {
    clearAutoAdvanceTimer();

    // Do not auto-advance if an understanding check is pending answer
    if (session?.activeCheck && !session.activeCheck.answered) {
      return;
    }

    // Natural 4-second teacher pause before transitioning to the next concept
    autoAdvanceTimerRef.current = setTimeout(() => {
      clearAutoAdvanceTimer();
      advanceNextStep();
    }, 4500);
  }, [session?.activeCheck]);

  // 5. Continuous Speech Recognition Setup (Listens naturally, handles student interruptions)
  const initSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
      setMicAvailable(false);
      setIsMicInitializing(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setMicAvailable(true);
        setIsMicInitializing(false);
        setMicError(null);
      };

      recognition.onerror = (event: any) => {
        setIsMicInitializing(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicAvailable(false);
          setMicError('Microphone permission denied. You can still type your questions below.');
        } else if (event.error === 'no-speech') {
          // Ignore no-speech, recognition auto-restarts
        } else if (event.error === 'network') {
          setMicError('Speech recognition network error. You can still type your questions below.');
        } else if (event.error === 'audio-capture') {
          setMicAvailable(false);
          setMicError('No microphone device found. You can still type your questions below.');
        }
      };

      recognition.onend = () => {
        // Automatically keep continuous listener alive while class is running and not muted
        if (isClassStarted && !isMicMutedRef.current && session?.state !== 'COMPLETED') {
          try {
            recognition.start();
          } catch {
            // Already active or starting
          }
        }
      };

      recognition.onresult = (event: any) => {
        if (isMicMutedRef.current) return;

        let latestInterim = '';
        let finalUtterance = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalUtterance += trans;
          } else {
            latestInterim += trans;
          }
        }

        const candidateText = (finalUtterance || latestInterim).trim();
        if (!candidateText || candidateText.length < 3) return;

        // PREVENT AI FROM HEARING ITSELF:
        if (isTeacherSpeakingRef.current) {
          const currentSpoken = (currentSpeechTextRef.current || '').toLowerCase();
          const candidateLower = candidateText.toLowerCase();

          const candidateWords = candidateLower.split(/\s+/).filter((w) => w.length > 2);
          if (candidateWords.length > 0) {
            const matches = candidateWords.filter((w) => currentSpoken.includes(w)).length;
            const overlapRatio = matches / candidateWords.length;
            if (overlapRatio > 0.45) {
              return;
            }
          }
        }

        setInterimTranscript(candidateText);
        setIsStudentSpeaking(true);

        if (finalUtterance && finalUtterance.trim().length > 3) {
          const questionToAsk = finalUtterance.trim();
          setInterimTranscript('');
          setIsStudentSpeaking(false);
          handleStudentInterruption(questionToAsk);
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setMicAvailable(false);
      setIsMicInitializing(false);
    }
  };

  // 6. Unified Student Question Handler (Both Voice & Text converge here)
  const handleStudentQuestion = async (question: string) => {
    if (!session || !question.trim() || isProcessingQuestion) return;
    const trimmed = question.trim();
    setIsProcessingQuestion(true);
    clearAutoAdvanceTimer();

    // Add student turn to conversation log
    const now = new Date();
    const ts = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversationLog(prev => [...prev, { role: 'student', text: trimmed, timestamp: ts }]);

    // Immediately pause teacher audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    setIsTeacherSpeaking(false);
    setTeacherState('THINKING');

    try {
      const res = await AIClassAPI.interrupt(session.classId, trimmed);
      setSession(res.session);
      setCurrentSpeechText(res.teacherResponse);

      // Add teacher response to conversation log
      const ts2 = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setConversationLog(prev => [...prev, { role: 'teacher', text: res.teacherResponse, timestamp: ts2 }]);

      if (res.audioUrl) {
        playTeacherVoice(res.audioUrl);
      } else {
        setTeacherState('LISTENING');
        scheduleAutoProgression();
      }
    } catch {
      addToast('Teacher could not process question. Continuing lecture.', 'warning');
      setTeacherState('LISTENING');
      scheduleAutoProgression();
    } finally {
      setIsProcessingQuestion(false);
    }
  };

  // Legacy alias for speech recognition handler
  const handleStudentInterruption = handleStudentQuestion;

  // Handle text input submission
  const handleTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || isProcessingQuestion) return;
    const question = textInput.trim();
    setTextInput('');
    handleStudentQuestion(question);
  };

  // Auto-scroll conversation log when new entries are added
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationLog.length]);

  // 7. Explicit Student Action: Start Class
  const handleStartClass = async () => {
    if (!session) return;
    const t0 = performance.now();
    startupTimersRef.current = { startClicked: t0 };
    console.log('[AI CLASS] start clicked: 0ms');

    // Optimistically render classroom immediately (<100ms)
    setIsClassStarted(true);
    setStartupState('STARTING');
    setTeacherState('THINKING');
    setStartupError(null);
    setCurrentSpeechText('Preparing your first lesson...');
    clearAutoAdvanceTimer();

    requestAnimationFrame(() => {
      const tRender = Math.round(performance.now() - t0);
      startupTimersRef.current.classroomRendered = tRender;
      console.log(`[AI CLASS] classroom rendered: ${tRender}ms`);
    });

    // Non-blocking microphone initialization in parallel
    setIsMicInitializing(true);
    initSpeechRecognition();

    // Fast lightweight session activation on backend
    try {
      const startRes = await AIClassAPI.startClass(session.classId);
      const tActivated = Math.round(performance.now() - t0);
      startupTimersRef.current.sessionActivated = tActivated;
      console.log(`[AI CLASS] session activated: ${tActivated}ms`);
      if (startRes.session) {
        setSession(startRes.session);
      }
    } catch (err) {
      console.warn('[AI CLASS] Session activation warning:', err);
    }

    // Asynchronously prepare and retrieve first teaching step
    try {
      const stepRes = await AIClassAPI.nextStep(session.classId);
      const tStep = Math.round(performance.now() - t0);
      startupTimersRef.current.firstLLMCompleted = tStep;
      console.log(`[AI CLASS] first teaching response generated: ${tStep}ms`);

      setSession(stepRes.session);
      setStartupState('TEACHING');

      if (stepRes.session.turns.length > 0) {
        const lastTurn = stepRes.session.turns[stepRes.session.turns.length - 1];
        setCurrentSpeechText(lastTurn.text);
      }

      if (stepRes.audioUrl) {
        const tTTS = Math.round(performance.now() - t0);
        startupTimersRef.current.firstTTSCompleted = tTTS;
        console.log(`[AI CLASS] first TTS completed: ${tTTS}ms`);
        playTeacherVoice(stepRes.audioUrl);
      } else {
        setTeacherState('LISTENING');
        scheduleAutoProgression();
      }

      // Automatically prefetch Concept 2 in background while student listens to Concept 1!
      AIClassAPI.prefetchNextStep(session.classId, 1);
    } catch (err: any) {
      console.error('[AI CLASS] First step preparation failed:', err);
      setStartupError("We couldn't prepare your first lesson.");
      setStartupState('ERROR');
    }
  };

  // 8. Advance to Next Concept in Curriculum (Auto or Fallback)
  const advanceNextStep = async () => {
    if (!session) return;
    clearAutoAdvanceTimer();
    setTeacherState('THINKING');
    setSelectedOption(null);

    try {
      const res = await AIClassAPI.nextStep(session.classId);
      setSession(res.session);
      if (res.session.turns.length > 0) {
        const lastTurn = res.session.turns[res.session.turns.length - 1];
        setCurrentSpeechText(lastTurn.text);
      }
      if (res.audioUrl) {
        playTeacherVoice(res.audioUrl);
      } else {
        setTeacherState('LISTENING');
        scheduleAutoProgression();
      }

      // Pre-fetch next concept in background
      const currentIdx = res.session.lessonPlan?.currentStepIndex || 0;
      AIClassAPI.prefetchNextStep(session.classId, currentIdx + 1);
    } catch {
      addToast('Could not advance to next concept.', 'error');
      setTeacherState('LISTENING');
    }
  };

  // 9. Pause / Resume Class
  const togglePause = async () => {
    if (!session) return;
    clearAutoAdvanceTimer();

    if (teacherState === 'PAUSED' || session.state === 'PAUSED') {
      // Resume
      if (audioPlayerRef.current && activeAudioUrl && !audioPlayerRef.current.ended) {
        audioPlayerRef.current.play();
        setIsTeacherSpeaking(true);
        setTeacherState('TEACHING');
      } else {
        setTeacherState('LISTENING');
        scheduleAutoProgression();
      }
      await AIClassAPI.resumeClass(session.classId);
      setSession((prev) => (prev ? { ...prev, state: 'TEACHING' } : null));
    } else {
      // Pause
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setIsTeacherSpeaking(false);
      setTeacherState('PAUSED');
      await AIClassAPI.pauseClass(session.classId);
      setSession((prev) => (prev ? { ...prev, state: 'PAUSED' } : null));
    }
  };

  // 10. Toggle Mic Mute (ONLY microphone control)
  const toggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    setMicError(null);
    if (nextMuted) {
      setIsStudentSpeaking(false);
      setInterimTranscript('');
    } else {
      // If speech recognition is not started yet, try to init
      if (!speechRecognitionRef.current) {
        initSpeechRecognition();
      }
    }
  };

  // Derive current mic state for UI display
  const micState: 'IDLE' | 'LISTENING' | 'PROCESSING' | 'ERROR' = 
    !micAvailable ? 'ERROR' :
    micError ? 'ERROR' :
    isMicInitializing ? 'PROCESSING' :
    isProcessingQuestion ? 'PROCESSING' :
    isMicMuted ? 'IDLE' :
    isStudentSpeaking ? 'LISTENING' :
    'LISTENING';

  // 11. Submit Answer to Understanding Check
  const handleSubmitCheck = async (answer: string) => {
    if (!session || !answer.trim() || isEvaluatingCheck) return;
    setIsEvaluatingCheck(true);
    clearAutoAdvanceTimer();
    try {
      const res = await AIClassAPI.answerCheck(session.classId, answer);
      setSession(res.session);
      addToast(res.feedback, res.isCorrect ? 'success' : 'info');
      // After answering, resume auto-progression countdown
      scheduleAutoProgression();
    } catch {
      addToast('Failed to evaluate answer.', 'error');
    } finally {
      setIsEvaluatingCheck(false);
    }
  };

  // 12. Generate Grounded Visual for Teaching Board
  const handleGenerateVisual = async () => {
    if (!session || isGeneratingVisual) return;
    setIsGeneratingVisual(true);
    try {
      const query = session.currentConcept || session.teachingBoard.title;
      const ans = currentSpeechText;
      const res = await VisualService.generateVisual(
        query,
        ans,
        'flowchart',
        session.teachingBoard.sources
      );
      if (res.visual) {
        let summaryDetail = res.visual.title;
        if (res.visual.type === 'flowchart') {
          summaryDetail = `Flow: ${res.visual.nodes.map((n) => n.label).join(' → ')}`;
        } else if (res.visual.type === 'mindmap') {
          summaryDetail = `Branches: ${res.visual.branches.map((b) => b.label).join(', ')}`;
        } else if (res.visual.type === 'diagram') {
          summaryDetail = `Components: ${res.visual.components.map((c) => c.label).join(' — ')}`;
        }

        const newBlock: TeachingBlock = {
          type: 'callout',
          title: `Visual Explanation: ${res.visual.title}`,
          content: summaryDetail,
        };
        setSession((prev) =>
          prev
            ? {
                ...prev,
                teachingBoard: {
                  ...prev.teachingBoard,
                  blocks: [...prev.teachingBoard.blocks, newBlock],
                },
              }
            : null
        );
        addToast('Visual diagram added to Teaching Board!', 'success');
      }
    } catch {
      addToast('Could not generate visual for board.', 'error');
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  // 13. End Class
  const handleEndClass = async () => {
    if (!session) return;
    setIsEnding(true);
    clearAutoAdvanceTimer();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    try {
      const completed = await AIClassAPI.endClass(session.classId);
      setSession(completed);
      setShowEndModal(true);
    } catch {
      addToast('Failed to conclude class.', 'error');
    } finally {
      setIsEnding(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoAdvanceTimer();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // ==========================================
  // RENDER: INITIAL SCREEN (NO AUTO-START)
  // ==========================================
  if (!isClassStarted) {
    const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0];
    const steps = session?.lessonPlan?.steps || [
      { topic: activeDoc ? activeDoc.name : 'Course Material', concept: 'Core Definition & Purpose' },
      { topic: activeDoc ? activeDoc.name : 'Course Material', concept: 'Why it is needed in systems' },
      { topic: activeDoc ? activeDoc.name : 'Course Material', concept: 'Mechanism and step-by-step flow' },
      { topic: activeDoc ? activeDoc.name : 'Course Material', concept: 'Real-world example and buffer management' },
      { topic: activeDoc ? activeDoc.name : 'Course Material', concept: 'Recap and key takeaways' },
    ];

    return (
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-8 animate-fade-in select-none">
        {/* Top bar back */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateTo('landing')}
            className="flex items-center gap-2 text-xs font-semibold text-[#5F6470] hover:text-[#1F242E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 border border-amber-300 text-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Ready to Learn
          </span>
        </div>

        {/* Hero Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#D4D2C9] shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#1E3A8A] font-bold">
                Private AI Live Class
              </span>
              <h1 className="text-xl sm:text-2xl font-serif-display font-bold text-[#1F242E]">
                {activeDoc ? activeDoc.name : 'Select Your Study Material'}
              </h1>
              <p className="text-xs sm:text-sm text-[#5F6470] mt-1 leading-relaxed">
                Your AI teacher is ready. In this 1-to-1 live class, the professor will explain the course material step-by-step on the live teaching board, write study notes, and continuously listen so you can naturally speak whenever you have a question.
              </p>
            </div>
          </div>

          {/* Curriculum Preview */}
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E7E5DF] space-y-3">
            <span className="text-[11px] font-mono uppercase font-bold text-[#5F6470] block">
              The class will cover:
            </span>
            <ul className="space-y-2">
              {steps.map((st, idx) => (
                <li key={idx} className="flex items-center gap-2.5 text-xs text-[#1F242E]">
                  <span className="w-5 h-5 rounded-full bg-white border border-[#D4D2C9] text-[10px] font-mono font-bold flex items-center justify-center text-[#1E3A8A]">
                    {idx + 1}
                  </span>
                  <span className="font-semibold">{st.concept}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Document Switcher (if user wants another file) */}
          {documents.length > 1 && (
            <div className="space-y-2 pt-2 border-t border-[#F5F4EE]">
              <span className="text-[11px] font-mono text-[#5F6470]">Change document:</span>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      doc.id === selectedDocId
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                        : 'bg-white text-[#1F242E] border-[#D4D2C9] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prominent Start Class Button */}
          <div className="pt-2">
            <button
              onClick={handleStartClass}
              disabled={isInitializing}
              className="w-full py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-[#172554] text-white font-serif-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all duration-150 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Start Class</span>
            </button>
            <p className="text-[11px] text-center text-[#737885] mt-2">
              Audio will play and your microphone will be ready for natural voice questions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE LIVE CLASSROOM
  // ==========================================
  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] bg-[#F8F7F2] overflow-hidden select-none">
      {/* 1. TOP HEADER */}
      <header className="px-4 sm:px-6 py-2.5 border-b border-[#E0DED7] bg-white flex items-center justify-between z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('landing')}
            className="p-1.5 rounded-lg hover:bg-[#F2F0E8] text-[#5F6470] transition-colors"
            title="Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif-display font-bold text-xs sm:text-sm text-[#1F242E]">
                  AI Live Class
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 border border-rose-300 text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                  LIVE {formatTime(elapsedSeconds)}
                </span>
              </div>
              <p className="text-[11px] text-[#5F6470] truncate max-w-xs sm:max-w-md">
                📄 {session?.documentName} · Concept: {session?.currentConcept || 'Introduction'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notes Button */}
          <button
            onClick={() => setShowNotesDrawer(!showNotesDrawer)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              showNotesDrawer
                ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                : 'bg-white hover:bg-[#FAF9F5] text-[#1F242E] border-[#D4D2C9]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Notes ({session?.notes.length || 0})</span>
          </button>

          {/* End Class */}
          <button
            onClick={handleEndClass}
            disabled={isEnding}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-xs"
          >
            End Class
          </button>
        </div>
      </header>

      {/* 2. THREE-AREA CLASSROOM STAGE */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: AI TEACHER STATION */}
        <div className="w-64 sm:w-72 border-r border-[#E0DED7] bg-white flex flex-col justify-between p-4 space-y-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Teacher Avatar Card */}
            <div className="p-4 rounded-2xl bg-[#FAF9F5] border border-[#E7E5DF] text-center space-y-3 shadow-xs">
              <div className="relative w-20 h-20 mx-auto">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-serif-display font-bold shadow-md transition-all ${
                    isTeacherSpeaking
                      ? 'bg-[#1E3A8A] ring-4 ring-indigo-200 animate-pulse'
                      : teacherState === 'LISTENING'
                      ? 'bg-emerald-700 ring-4 ring-emerald-100'
                      : 'bg-[#2E3545]'
                  }`}
                >
                  AI
                </div>
                {isTeacherSpeaking && (
                  <span className="absolute bottom-0 right-0 p-1 rounded-full bg-emerald-500 text-white shadow-xs">
                    <Volume2 className="w-3.5 h-3.5" />
                  </span>
                )}
                {teacherState === 'LISTENING' && !isTeacherSpeaking && (
                  <span className="absolute bottom-0 right-0 p-1 rounded-full bg-emerald-600 text-white shadow-xs">
                    <Mic className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <div>
                <span className="font-serif-display font-bold text-xs text-[#1F242E] block">
                  Professor Multimodal
                </span>
                {/* Natural Teacher Status */}
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium">
                  {startupState === 'STARTING' ? (
                    <span className="text-amber-700 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span>Preparing lesson...</span>
                    </span>
                  ) : startupState === 'ERROR' ? (
                    <div className="space-y-1">
                      <span className="text-rose-600 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Preparation failed</span>
                      </span>
                      <button
                        onClick={handleStartClass}
                        className="px-2.5 py-0.5 rounded bg-[#1E3A8A] text-white text-[10px] font-semibold hover:bg-[#172554] cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  ) : teacherState === 'TEACHING' ? (
                    <span className="text-[#1E3A8A] flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                      <span>Teaching</span>
                    </span>
                  ) : teacherState === 'LISTENING' ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Mic className="w-3.5 h-3.5 animate-pulse" />
                      <span>Listening</span>
                    </span>
                  ) : teacherState === 'THINKING' ? (
                    <span className="text-amber-700 flex items-center gap-1">
                      <span className="animate-spin text-sm">◌</span>
                      <span>Thinking</span>
                    </span>
                  ) : teacherState === 'PAUSED' ? (
                    <span className="text-gray-600 flex items-center gap-1">
                      <Pause className="w-3.5 h-3.5" />
                      <span>Class Paused</span>
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Audio Playback Controls & Retry Warning */}
              {audioError ? (
                <div className="pt-2 border-t border-[#E7E5DF] space-y-1">
                  <span className="text-[11px] text-rose-600 block">{audioError}</span>
                  {activeAudioUrl && (
                    <button
                      onClick={() => playTeacherVoice(activeAudioUrl)}
                      className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100"
                    >
                      Retry Audio
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 pt-1 border-t border-[#E7E5DF]">
                  {activeAudioUrl && (
                    <button
                      onClick={() => playTeacherVoice(activeAudioUrl)}
                      className="p-1.5 rounded-lg bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] text-xs text-[#1F242E] transition-colors"
                      title="Replay explanation"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Teacher Speech Transcript Preview */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-[#5F6470]">
                Teacher Speech
              </span>
              <p className="text-xs text-[#1F242E] leading-relaxed bg-[#FAF9F5] p-3 rounded-xl border border-[#E7E5DF] italic">
                "{currentSpeechText || 'Preparing explanation...'}"
              </p>
            </div>

            {/* Student Live Speech Feedback (Interim Transcript) */}
            {isStudentSpeaking && interimTranscript && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1 animate-fade-in">
                <div className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-700">
                  <Mic className="w-3 h-3 animate-pulse" />
                  <span>Hearing You...</span>
                </div>
                <p className="italic">"{interimTranscript}"</p>
              </div>
            )}

            {/* Curriculum Progress */}
            {session?.lessonPlan && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#5F6470]">
                  <span>Lesson Progress</span>
                  <span>
                    {(session.lessonPlan.currentStepIndex || 0) + 1} of {session.lessonPlan.steps.length}
                  </span>
                </div>
                <div className="w-full bg-[#E7E5DF] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#1E3A8A] h-full transition-all duration-300"
                    style={{
                      width: `${
                        (((session.lessonPlan.currentStepIndex || 0) + 1) / session.lessonPlan.steps.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Teacher State Controls */}
          {teacherState === 'PAUSED' ? (
            <button
              onClick={togglePause}
              className="w-full py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-[#172554] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Resume Class</span>
            </button>
          ) : teacherState === 'LISTENING' && session?.lessonPlan ? (
            <button
              onClick={advanceNextStep}
              className="w-full py-1.5 rounded-lg border border-[#D4D2C9] bg-white hover:bg-[#FAF9F5] text-[#5F6470] hover:text-[#1F242E] text-[11px] font-medium transition-colors flex items-center justify-center gap-1"
            >
              <span>Continue →</span>
            </button>
          ) : null}
        </div>

        {/* CENTER COLUMN: LIVE TEACHING BOARD (MAIN FOCUS) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1E232F] text-white p-4 sm:p-6 shadow-inner">
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Board Header */}
            <div className="border-b border-white/10 pb-3 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">
                {startupState === 'STARTING'
                  ? 'Session Initialized'
                  : session?.teachingBoard.subtitle || 'Teaching Board'}
              </span>
              <h2 className="text-xl sm:text-2xl font-serif-display font-bold text-white tracking-tight">
                {startupState === 'STARTING'
                  ? 'Your class is getting ready.'
                  : session?.teachingBoard.title || 'Welcome'}
              </h2>
            </div>

            {/* Dynamic Teaching Blocks */}
            <div className="space-y-4">
              {startupState === 'STARTING' ? (
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                      <Sparkles className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-base">Preparing your first lesson...</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        The AI professor is reviewing your study material and preparing the first concept explanation.
                      </p>
                    </div>
                  </div>
                </div>
              ) : startupState === 'ERROR' ? (
                <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-white text-sm">We couldn't prepare your first lesson.</h4>
                      <p className="text-xs text-gray-400">
                        {startupError || "There was an issue preparing the initial concept. You can retry immediately."}
                      </p>
                      <button
                        onClick={handleStartClass}
                        className="px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#172554] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Retry Lesson Preparation
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                session?.teachingBoard.blocks.map((block, bIdx) => {
                  if (block.type === 'heading') {
                    return (
                      <h3
                        key={bIdx}
                        className="text-base sm:text-lg font-bold text-indigo-200 border-l-2 border-indigo-400 pl-3"
                      >
                        {block.text}
                      </h3>
                    );
                  }

                  if (block.type === 'bullets') {
                    return (
                      <ul key={bIdx} className="space-y-2 pl-2">
                        {block.items.map((it, iIdx) => (
                          <li key={iIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-200">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                            <span className="leading-relaxed">{it}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }

                  if (block.type === 'steps') {
                    return (
                      <div key={bIdx} className="space-y-2">
                        {block.items.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3"
                          >
                            <span className="w-5 h-5 rounded-full bg-indigo-500/30 text-indigo-300 font-mono text-xs flex items-center justify-center flex-shrink-0 font-bold">
                              {sIdx + 1}
                            </span>
                            <span className="text-xs sm:text-sm text-gray-200 leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (block.type === 'definition') {
                    return (
                      <div
                        key={bIdx}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs sm:text-sm"
                      >
                        <span className="font-bold text-indigo-300 block">{block.term}</span>
                        <p className="text-gray-300 leading-relaxed">{block.explanation}</p>
                      </div>
                    );
                  }

                  if (block.type === 'example') {
                    return (
                      <div
                        key={bIdx}
                        className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs sm:text-sm space-y-1.5"
                      >
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>💡 Example:</span>
                          <span>{block.title}</span>
                        </span>
                        <p className="text-amber-100/90 leading-relaxed">{block.content}</p>
                      </div>
                    );
                  }

                  if (block.type === 'comparison') {
                    return (
                      <div key={bIdx} className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white/10 text-indigo-200">
                              {block.columns.map((col, cIdx) => (
                                <th key={cIdx} className="p-2.5 font-semibold border-b border-white/10">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="border-b border-white/5 hover:bg-white/5">
                                {row.map((cell, cellIdx) => (
                                  <td key={cellIdx} className="p-2.5 text-gray-300">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  if (block.type === 'callout') {
                    return (
                      <div
                        key={bIdx}
                        className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs sm:text-sm space-y-1 text-indigo-100"
                      >
                        <span className="font-bold text-indigo-300 font-mono uppercase text-[10px] tracking-wider block">
                          {block.title}
                        </span>
                        <p className="leading-relaxed whitespace-pre-line">{block.content}</p>
                      </div>
                    );
                  }

                  return null;
                })
              )}
            </div>

            {/* Interactive Understanding Check */}
            {session?.activeCheck && (
              <div className="p-4.5 rounded-2xl bg-white/10 border border-indigo-400/50 space-y-3.5 shadow-lg animate-fade-in">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4" />
                  <span>Understanding Check</span>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {session.activeCheck.question}
                </p>

                {/* Multiple Choice Options */}
                {session.activeCheck.type === 'multiple-choice' && session.activeCheck.options && (
                  <div className="space-y-2">
                    {session.activeCheck.options.map((opt, oIdx) => {
                      const isSelected = selectedOption === opt;
                      return (
                        <button
                          key={oIdx}
                          disabled={session.activeCheck?.answered}
                          onClick={() => {
                            setSelectedOption(opt);
                            handleSubmitCheck(opt);
                          }}
                          className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-400 text-white font-medium'
                              : 'bg-white/5 hover:bg-white/10 border-white/15 text-gray-200'
                          }`}
                        >
                          <span>{opt}</span>
                          {isSelected && <Check className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Feedback reveal */}
                {session.activeCheck.answered && session.activeCheck.feedback && (
                  <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs animate-fade-in space-y-1">
                    <span className="font-bold block">Professor Feedback:</span>
                    <p>{session.activeCheck.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Teaching Board Citations Footer */}
            {session?.teachingBoard.sources && session.teachingBoard.sources.length > 0 && (
              <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] font-mono text-indigo-300/80">
                <Paperclip className="w-3.5 h-3.5" />
                <span>
                  📄 {session.teachingBoard.sources[0].documentName} (p.{' '}
                  {session.teachingBoard.sources.map((s) => s.pageNumber || s.page).filter(Boolean).join(', ')}
                  )
                </span>
              </div>
            )}
          </div>

          {/* TEACHING BOARD CONTROLS BAR */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              {/* Pause Class */}
              <button
                onClick={togglePause}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                {teacherState === 'PAUSED' ? (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Class</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Class</span>
                  </>
                )}
              </button>

              {/* Visualize Concept */}
              <button
                onClick={handleGenerateVisual}
                disabled={isGeneratingVisual}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium flex items-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>{isGeneratingVisual ? 'Generating...' : 'Visualize'}</span>
              </button>
            </div>
          </div>

          {/* ================================================ */}
          {/* LIVE TRANSCRIPT + STUDENT INPUT AREA              */}
          {/* ================================================ */}
          <div className="mt-2 border-t border-white/10 pt-2 flex flex-col" style={{ maxHeight: '40%' }}>
            {/* Conversation Transcript */}
            {conversationLog.length > 0 && (
              <div className="flex-shrink overflow-y-auto mb-2 space-y-1.5 max-h-36 pr-1 scroll-smooth">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-indigo-300/70 font-bold mb-1">
                  <MessageCircle className="w-3 h-3" />
                  <span>Live Transcript</span>
                </div>
                {conversationLog.map((entry, idx) => (
                  <div key={idx} className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                    entry.role === 'teacher'
                      ? 'bg-indigo-950/50 border border-indigo-500/20'
                      : 'bg-emerald-950/50 border border-emerald-500/20'
                  }`}>
                    <span className={`font-mono font-bold text-[10px] uppercase flex-shrink-0 mt-0.5 ${
                      entry.role === 'teacher' ? 'text-indigo-300' : 'text-emerald-300'
                    }`}>
                      {entry.role === 'teacher' ? 'Teacher' : 'You'}
                    </span>
                    <p className={`leading-relaxed ${
                      entry.role === 'teacher' ? 'text-indigo-100/90' : 'text-emerald-100/90'
                    }`}>
                      {entry.text.length > 200 ? entry.text.slice(0, 200) + '…' : entry.text}
                    </p>
                    <span className="text-[9px] text-gray-500 font-mono flex-shrink-0 mt-0.5">{entry.timestamp}</span>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </div>
            )}

            {/* Mic State Indicator + Interim Transcript */}
            {(isStudentSpeaking || isProcessingQuestion || micError) && (
              <div className="mb-2">
                {micError ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{micError}</span>
                  </div>
                ) : isProcessingQuestion ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
                    <span className="animate-spin text-sm">◌</span>
                    <span>Understanding your question...</span>
                  </div>
                ) : isStudentSpeaking && interimTranscript ? (
                  <div className="px-3 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                      </span>
                      <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-emerald-300">Listening...</span>
                      {/* Simple waveform indicator */}
                      <div className="flex items-center gap-0.5 h-4">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="w-0.5 bg-emerald-400 rounded-full" style={{
                            height: `${8 + Math.sin(Date.now() / (150 + i * 30)) * 8}px`,
                            animation: `pulse ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                          }} />
                        ))}
                      </div>
                    </div>
                    <p className="text-emerald-100/90 italic pl-5">"{interimTranscript}"</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* Student Input Area: Mic + Text + Send */}
            <form onSubmit={handleTextSubmit} className="flex items-center gap-2 flex-shrink-0">
              {/* Microphone Button with clear state */}
              <button
                type="button"
                onClick={toggleMicMute}
                disabled={isMicInitializing}
                className={`relative flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-xs ${
                  isMicInitializing
                    ? 'bg-amber-900/60 text-amber-200 border border-amber-700/50 cursor-wait'
                  : !micAvailable
                    ? 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                  : isMicMuted
                    ? 'bg-white/10 text-gray-400 border border-white/20 hover:bg-white/15'
                    : isStudentSpeaking
                    ? 'bg-rose-600 text-white border border-rose-400 ring-2 ring-rose-400/50'
                    : 'bg-emerald-700 text-white border border-emerald-500 hover:bg-emerald-600'
                }`}
                title={
                  isMicInitializing ? 'Preparing microphone...' :
                  !micAvailable ? 'Microphone unavailable' :
                  isMicMuted ? 'Click to enable microphone' :
                  isStudentSpeaking ? 'Listening...' :
                  'Microphone active — click to mute'
                }
              >
                {isMicInitializing ? (
                  <span className="animate-spin text-sm">◌</span>
                ) : isMicMuted || !micAvailable ? (
                  <MicOff className="w-4.5 h-4.5" />
                ) : (
                  <Mic className="w-4.5 h-4.5" />
                )}
                {/* Pulsing ring when actively listening */}
                {!isMicMuted && micAvailable && !isMicInitializing && isStudentSpeaking && (
                  <span className="absolute inset-0 rounded-xl border-2 border-rose-400 animate-ping opacity-50" />
                )}
              </button>

              {/* Text Input */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    teacherState === 'PAUSED' ? 'Class is paused...' :
                    isProcessingQuestion ? 'Processing your question...' :
                    'Ask your teacher something...'
                  }
                  disabled={isProcessingQuestion || teacherState === 'PAUSED'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={!textInput.trim() || isProcessingQuestion || teacherState === 'PAUSED'}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/10 disabled:text-gray-600 text-white flex items-center justify-center transition-all shadow-xs disabled:cursor-not-allowed"
                title="Send question"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Mic status line */}
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] font-mono text-gray-500">
              <div className="flex items-center gap-1.5">
                {isMicInitializing ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /><span>Preparing mic...</span></>
                ) : !micAvailable ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-rose-500" /><span>Mic unavailable · type below</span></>
                ) : isMicMuted ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-gray-500" /><span>Mic muted · tap to speak</span></>
                ) : isStudentSpeaking ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /><span className="text-emerald-300">Speak now...</span></>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span>Mic on · speak anytime or type</span></>
                )}
              </div>
              <span>{isMicMuted ? '' : 'Voice + Text'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT DRAWER: LIVE STUDY NOTES */}
        {showNotesDrawer && (
          <aside className="w-80 border-l border-[#E0DED7] bg-[#FAF9F5] flex flex-col h-full z-10 animate-slide-left">
            <div className="p-3.5 border-b border-[#E0DED7] flex items-center justify-between bg-white">
              <span className="font-serif-display font-bold text-xs text-[#1F242E] uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                Live Study Notes
              </span>
              <button
                onClick={() => setShowNotesDrawer(false)}
                className="text-xs text-[#5F6470] hover:text-[#1F242E]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans text-xs">
              {session?.notes.map((note, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white border border-[#E0DED7] space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between font-mono text-[10px] text-[#5F6470]">
                    <span className="font-bold text-[#1E3A8A] uppercase">{note.section}</span>
                    <span>{note.timestamp}</span>
                  </div>
                  <p className="text-[#1F242E] leading-relaxed">{note.content}</p>
                  {note.keyPoints && note.keyPoints.length > 0 && (
                    <ul className="space-y-0.5 pl-1 border-t border-[#F5F4EE] pt-1">
                      {note.keyPoints.map((p, pIdx) => (
                        <li key={pIdx} className="text-[11px] text-[#5F6470] flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[#1E3A8A] mt-1.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-[#E0DED7] bg-white">
              <a
                href={session ? AIClassAPI.getExportNotesPdfUrl(session.classId) : '#'}
                download
                className="w-full py-2 rounded-xl bg-[#1E3A8A] text-white font-semibold text-xs text-center block hover:bg-[#172554] transition-colors"
              >
                Download Notes PDF
              </a>
            </div>
          </aside>
        )}
      </div>

      {/* 3. END CLASS MODAL */}
      {showEndModal && session && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#D4D2C9] max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle className="w-7 h-7 text-emerald-700" />
              </div>
              <h2 className="text-xl font-serif-display font-bold text-[#1F242E]">
                Class Complete!
              </h2>
              <p className="text-xs text-[#5F6470]">
                Private lecture on <span className="font-semibold text-[#1F242E]">{session.documentName}</span> concluded.
              </p>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAF9F5] border border-[#E7E5DF] text-center font-mono">
              <div>
                <span className="text-[10px] uppercase text-[#737885] block">Duration</span>
                <span className="text-sm font-bold text-[#1F242E]">
                  {formatTime(session.durationSeconds || elapsedSeconds)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#737885] block">Topics</span>
                <span className="text-sm font-bold text-[#1F242E]">{session.topicsCovered.length}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-[#737885] block">Notes Saved</span>
                <span className="text-sm font-bold text-[#1F242E]">{session.notes.length}</span>
              </div>
            </div>

            {/* Export Actions */}
            <div className="space-y-2 pt-2 border-t border-[#F5F4EE]">
              <span className="text-[11px] font-mono text-[#5F6470] block">Class Material Exports:</span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={AIClassAPI.getExportNotesPdfUrl(session.classId)}
                  download
                  className="p-2.5 rounded-xl border border-[#D4D2C9] bg-white hover:bg-[#FAF9F5] text-xs font-semibold text-[#1F242E] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Study Notes PDF</span>
                </a>
                <a
                  href={AIClassAPI.getExportTranscriptPdfUrl(session.classId)}
                  download
                  className="p-2.5 rounded-xl border border-[#D4D2C9] bg-white hover:bg-[#FAF9F5] text-xs font-semibold text-[#1F242E] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#1E3A8A]" />
                  <span>Transcript PDF</span>
                </a>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => navigateTo('landing')}
                className="w-full py-2.5 rounded-xl bg-[#1E3A8A] text-white font-semibold text-xs text-center hover:bg-[#172554] transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
