import React, { useState, useRef, useEffect } from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { 
  Paperclip, 
  Image as ImageIcon, 
  Mic, 
  Square,
  Sparkles,
  ArrowUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { BrowserAudioRecorder, SpeechService } from '../../services/speechService';
import { SpeechInputState } from '../../types/speech';

interface Props {
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  selectedFollowUp?: string;
}

export const AIInput: React.FC<Props> = ({ 
  onSendMessage, 
  isThinking, 
  selectedFollowUp 
}) => {
  const [inputText, setInputText] = useState('');
  const [speechState, setSpeechState] = useState<SpeechInputState>('IDLE');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<BrowserAudioRecorder | null>(null);

  const { setUploadDocumentModalOpen } = useLearning();
  const { navigateTo, addToast } = useApp();

  const researchPrompts = [
    'Explain this simply',
    'Compare two concepts',
    'Summarize this section',
    'Give me an example',
    'Create a quiz'
  ];

  useEffect(() => {
    if (selectedFollowUp) {
      setInputText(selectedFollowUp);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [selectedFollowUp]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isThinking || speechState === 'LISTENING' || speechState === 'PROCESSING') return;

    onSendMessage(inputText.trim());
    setInputText('');
    setSpeechError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Start microphone audio recording
   */
  const handleStartVoice = async () => {
    setSpeechError(null);
    try {
      const recorder = new BrowserAudioRecorder();
      recorderRef.current = recorder;
      await recorder.startRecording();
      setSpeechState('LISTENING');
    } catch (err: any) {
      setSpeechState('ERROR');
      const msg = err.message || 'Could not access microphone.';
      setSpeechError(msg);
      addToast(msg, 'error');
    }
  };

  /**
   * Stop recording, send audio to Azure Speech backend, and insert transcript into input
   */
  const handleStopVoice = async () => {
    if (!recorderRef.current || speechState !== 'LISTENING') return;

    setSpeechState('PROCESSING');
    try {
      const audioBlob = await recorderRef.current.stopRecording();
      recorderRef.current = null;

      const result = await SpeechService.transcribe(audioBlob);

      if (result.success && result.transcript) {
        // IMPORTANT: Insert transcript into input, do NOT auto-submit!
        setInputText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${result.transcript}` : result.transcript;
        });
        setSpeechState('TRANSCRIBED');
        addToast('Speech transcribed. You can edit your question before asking.', 'success');

        if (textareaRef.current) {
          textareaRef.current.focus();
        }

        setTimeout(() => {
          setSpeechState('IDLE');
        }, 2500);
      }
    } catch (err: any) {
      setSpeechState('ERROR');
      const msg = err.message || 'Speech transcription failed.';
      setSpeechError(msg);
      addToast(msg, 'error');
    }
  };

  /**
   * Cancel in-progress recording
   */
  const handleCancelVoice = () => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
      recorderRef.current = null;
    }
    setSpeechState('IDLE');
    setSpeechError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadDocumentModalOpen(true);
    }
  };

  return (
    <div className="p-4 sm:p-5 bg-white border-t border-[#E7E5DF] select-none">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Suggested prompts and Voice Trigger Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
            <span className="text-[10px] font-semibold text-[#5F6470] uppercase tracking-wider font-mono flex items-center gap-1 flex-shrink-0">
              <Sparkles className="w-3 h-3 text-[#1E3A8A]" />
              Prompts:
            </span>
            {researchPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setInputText(prompt);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="px-2.5 py-1 text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] hover:border-[#BDB9AC] rounded-lg whitespace-nowrap transition-colors duration-150 shadow-xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Ask By Voice Primary Pill */}
          {speechState === 'IDLE' && (
            <button
              type="button"
              onClick={handleStartVoice}
              disabled={isThinking}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#1E3A8A] bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 rounded-full transition-all duration-150 shadow-xs active:scale-95"
              title="Speak your question using your microphone"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Ask by voice</span>
            </button>
          )}
        </div>

        {/* Live Speech Recording Status Banner */}
        {speechState === 'LISTENING' && (
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-medium">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
              </span>
              <span>Listening... Speak your question clearly into your microphone</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStopVoice}
                className="flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs transition-colors"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Done</span>
              </button>
              <button
                type="button"
                onClick={handleCancelVoice}
                className="px-2 py-1 text-rose-700 hover:text-rose-900 font-medium hover:underline text-[11px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live Speech Processing Status Banner */}
        {speechState === 'PROCESSING' && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs animate-in fade-in duration-150">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span className="font-medium">Transcribing your voice with Azure Speech...</span>
          </div>
        )}

        {/* Speech Error Banner */}
        {speechState === 'ERROR' && speechError && (
          <div className="flex items-center justify-between px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>{speechError}</span>
            </div>
            <button
              type="button"
              onClick={() => { setSpeechState('IDLE'); setSpeechError(null); }}
              className="text-amber-800 hover:text-amber-950 font-medium text-[11px] underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Input Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col rounded-xl border transition-all ${
            isDragging 
              ? 'border-[#1E3A8A] bg-blue-50/40 ring-2 ring-[#1E3A8A]/20' 
              : 'border-[#D4D2C9] bg-[#FAF9F5] focus-within:bg-white focus-within:border-[#1E3A8A] focus-within:ring-2 focus-within:ring-[#1E3A8A]/10'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isThinking || speechState === 'LISTENING' || speechState === 'PROCESSING'}
            placeholder="Ask anything about this material, or click 'Ask by voice'..."
            rows={2}
            className="w-full px-4 pt-3.5 pb-2 text-xs sm:text-sm bg-transparent resize-none focus:outline-none placeholder:text-[#737887] disabled:opacity-50 text-[#1F242E] font-sans"
          />

          {/* Action controls */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-transparent">
            {/* Attachment, Vision, Voice */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setUploadDocumentModalOpen(true)}
                className="p-1.5 text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                title="Attach Document (PDF, Notes, Slides)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('vision')}
                className="p-1.5 text-[#5F6470] hover:text-[#1E3A8A] hover:bg-[#F2F0E8] active:bg-[#E7E5DF] rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                title="Understand an image or diagram in Vision Studio"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={speechState === 'LISTENING' ? handleStopVoice : handleStartVoice}
                disabled={isThinking || speechState === 'PROCESSING'}
                className={`p-1.5 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
                  speechState === 'LISTENING'
                    ? 'bg-rose-100 text-rose-700 animate-pulse' 
                    : speechState === 'PROCESSING'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-[#5F6470] hover:text-[#1E3A8A] hover:bg-[#F2F0E8]'
                }`}
                title={speechState === 'LISTENING' ? 'Stop voice recording' : 'Record voice with microphone'}
              >
                {speechState === 'LISTENING' ? (
                  <Square className="w-4 h-4 fill-current text-rose-600" />
                ) : speechState === 'PROCESSING' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <span className="hidden sm:inline text-[11px] text-[#737887] ml-2">
                Press Enter to ask, Shift+Enter for new line
              </span>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!inputText.trim() || isThinking || speechState === 'LISTENING' || speechState === 'PROCESSING'}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] ${
                !inputText.trim() || isThinking || speechState === 'LISTENING' || speechState === 'PROCESSING'
                  ? 'bg-[#FAF9F5] text-[#A3A5AA] border border-[#D4D2C9] cursor-not-allowed'
                  : 'bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white border border-[#161B22] shadow-sm'
              }`}
              title="Submit Query"
              aria-label="Submit Query"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
