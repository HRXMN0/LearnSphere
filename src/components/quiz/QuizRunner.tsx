import React, { useState } from 'react';
import { QuizQuestion, QuizSubmission } from '../../types/quiz';
import { quizService } from '../../services/quizService';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  BookOpen
} from 'lucide-react';
import { CapabilityBadge } from '../common/CapabilityBadge';

interface Props {
  questions: QuizQuestion[];
  documentId?: string;
  topic?: string;
  onFinish: (submission: QuizSubmission) => void;
  onCancel: () => void;
}

export const QuizRunner: React.FC<Props> = ({ questions, documentId, topic, onFinish, onCancel }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [questionId: string]: number }>({});
  const [hasRevealedAnswer, setHasRevealedAnswer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQ = questions[currentIndex];
  const selectedOptionIndex = selectedAnswers[currentQ.id];
  const isAnswered = selectedOptionIndex !== undefined;

  const handleSelectOption = (idx: number) => {
    if (hasRevealedAnswer) return; // locked once checked
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: idx
    }));
  };

  const handleConfirmAnswer = () => {
    setHasRevealedAnswer(true);
  };

  const handleNextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setHasRevealedAnswer(false);
    } else {
      setIsSubmitting(true);
      const results = await quizService.evaluateQuiz(
        `quiz-${Date.now()}`,
        selectedAnswers,
        questions,
        { documentId, topic }
      );
      setIsSubmitting(false);
      onFinish(results);
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E7E5DF] p-6 sm:p-8 shadow-elevated space-y-6 animate-slide-up select-none">
      {/* Top Header & Progress */}
      <div className="space-y-3 pb-4 border-b border-[#E7E5DF]">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1A1A18] font-mono text-sm">
              Question {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
            </span>
            <span className="text-[#A3A29B]">•</span>
            <span className="text-cobalt-700 font-semibold">{currentQ.sourceReference.topic}</span>
          </div>
          <CapabilityBadge capability="GENERATIVE AI" size="sm" />
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-[#FAF9F5] border border-[#E7E5DF] rounded-full overflow-hidden">
          <div
            className="h-full bg-cobalt-600 transition-all duration-300 rounded-full"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold font-serif-display text-[#1A1A18] leading-snug">
          {currentQ.prompt}
        </h3>
        <p className="text-[11px] text-[#7A7973] font-mono">
          Source: {currentQ.sourceReference.documentName} (Page {currentQ.sourceReference.page})
        </p>
      </div>

      {/* Answer Options */}
      <div className="space-y-2.5">
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedOptionIndex === idx;
          const isCorrect = idx === currentQ.correctAnswerIndex;

          let optionStyle = 'bg-white border-[#D4D2C9] hover:border-[#BDB9AC] text-[#1F242E] hover:bg-[#F2F0E8]';

          if (isSelected && !hasRevealedAnswer) {
            optionStyle = 'bg-[#F2F0E8] border-[#1F242E] text-[#1F242E] font-semibold ring-2 ring-[#1F242E]/15 shadow-xs';
          } else if (hasRevealedAnswer) {
            if (isCorrect) {
              optionStyle = 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold ring-1 ring-emerald-500';
            } else if (isSelected && !isCorrect) {
              optionStyle = 'bg-rose-50 border-rose-400 text-rose-950 ring-1 ring-rose-400';
            } else {
              optionStyle = 'bg-[#FAF9F5] border-[#E7E5DF] text-[#A3A5AA] opacity-60';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelectOption(idx)}
              className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl border text-xs sm:text-sm text-left transition-colors duration-150 ${optionStyle}`}
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs font-mono flex-shrink-0 ${
                isSelected && !hasRevealedAnswer
                  ? 'bg-[#1F242E] text-white'
                  : hasRevealedAnswer && isCorrect
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#FAF9F5] border border-[#D4D2C9] text-[#1F242E]'
              }`}>
                {optionLetters[idx]}
              </span>

              <span className="flex-1 leading-relaxed">{opt}</span>

              {hasRevealedAnswer && isCorrect && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              )}
              {hasRevealedAnswer && isSelected && !isCorrect && (
                <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Immediate Explanation with Grounded Source Citation */}
      {hasRevealedAnswer && (
        <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#D4D2C9] space-y-2 animate-slide-up">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={selectedOptionIndex === currentQ.correctAnswerIndex ? 'text-emerald-800' : 'text-rose-800'}>
              {selectedOptionIndex === currentQ.correctAnswerIndex ? '✓ Correct Answer' : '✕ Incorrect Answer'}
            </span>
            <span className="text-[#5F6470] font-mono text-[11px]">
              Page {currentQ.sourceReference.page}
            </span>
          </div>

          <p className="text-xs text-[#1F242E] leading-relaxed">
            {currentQ.explanation}
          </p>

          <div className="flex items-center gap-1.5 text-[11px] text-[#1E3A8A] font-medium pt-1 font-mono">
            <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Grounded Source: {currentQ.sourceReference.documentName}</span>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#D4D2C9]">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-[#5F6470] hover:text-[#1F242E] hover:bg-[#F2F0E8] border border-[#D4D2C9] rounded-lg transition-colors duration-150"
        >
          Exit Quiz
        </button>

        <div className="flex items-center gap-2">
          {!hasRevealedAnswer ? (
            <button
              onClick={handleConfirmAnswer}
              disabled={!isAnswered}
              className="px-5 py-2 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz & View Score'}</span>
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
