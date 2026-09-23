import React, { useRef, useEffect, useState } from 'react';
import { useLearning } from '../../context/LearningContext';
import { ChatMessageItem } from './ChatMessageItem';
import { AIInput } from './AIInput';
import { CapabilityBadge } from '../common/CapabilityBadge';
import { Sparkles, Database, Loader2, RefreshCw, BookOpen } from 'lucide-react';

export const ChatStream: React.FC = () => {
  const { 
    chatMessages, 
    isAIThinking, 
    aiThinkingStep, 
    askQuestion, 
    activeDocumentIds,
    documents,
    resetDemoState 
  } = useLearning();

  const [selectedFollowUp, setSelectedFollowUp] = useState<string | undefined>(undefined);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [chatMessages, isAIThinking, aiThinkingStep]);

  const handleSendMessage = (text: string) => {
    setSelectedFollowUp(undefined);
    askQuestion(text);
  };

  const handleSelectPrompt = (prompt: string) => {
    setSelectedFollowUp(prompt);
  };

  const lastUserQuery = [...chatMessages].reverse().find(m => m.role === 'user')?.content;

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FAF9F5]">
      {/* Editorial Research Top Banner */}
      <div className="h-14 px-4 sm:px-6 border-b border-[#E7E5DF] bg-white flex items-center justify-between flex-shrink-0 select-none">
        <div>
          <h2 className="text-xs sm:text-sm font-semibold text-[#1A1A18] font-serif-display tracking-tight flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cobalt-600" />
            Ask about your material
          </h2>
          <p className="text-[11px] text-[#7A7973] line-clamp-1">
            Answers are grounded in your selected learning materials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeDocumentIds.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Database className="w-3 h-3 text-amber-600" />
              No Material Selected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F242E] bg-[#FAF9F5] px-2 py-0.5 rounded-full border border-[#D4D2C9]">
              <Database className="w-3 h-3 text-[#1E3A8A]" />
              {activeDocumentIds.length} {activeDocumentIds.length === 1 ? 'Material Selected' : 'Materials Selected'}
            </span>
          )}

          <button
            onClick={resetDemoState}
            className="p-1.5 text-[#7A7973] hover:text-[#1A1A18] hover:bg-[#F5F4EE] rounded-lg transition-colors"
            title="Reset discussion to initial state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto w-full"
      >
        {chatMessages.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#7A7973] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#E7E5DF] text-cobalt-600 flex items-center justify-center mx-auto shadow-soft">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-serif-display text-[#1A1A18]">
              Ready for your questions
            </h3>
            <p className="text-xs text-[#7A7973] max-w-md mx-auto leading-relaxed">
              Ask anything about your syllabus concepts, protocols, or formulas. Every answer is grounded directly in your uploaded textbooks and notes with verifiable citations.
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              userQueryForSourceContext={lastUserQuery}
              onSelectPrompt={handleSelectPrompt}
            />
          ))
        )}

        {/* AI Thinking / Retrieval Loading Indicator */}
        {isAIThinking && (
          <div className="flex items-start gap-3.5 pt-2 animate-slide-up">
            <div className="w-7 h-7 rounded-lg bg-[#1A1A18] text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-soft">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E7E5DF] shadow-soft max-w-md space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-cobalt-700">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cobalt-600" />
                <span>{aiThinkingStep || 'Searching your learning material...'}</span>
              </div>
              <div className="w-48 h-1 bg-[#EBE9E1] rounded-full overflow-hidden">
                <div className="h-full bg-cobalt-600 rounded-full animate-pulse w-3/4" />
              </div>
              <p className="text-[10px] text-[#A3A29B] font-mono">
                Azure AI Search: Embedding question → Retrieving chunks → Synthesizing answer
              </p>
            </div>
          </div>
        )}
      </div>

      {/* AI Input Area */}
      <AIInput
        onSendMessage={handleSendMessage}
        isThinking={isAIThinking}
        selectedFollowUp={selectedFollowUp}
      />
    </div>
  );
};
