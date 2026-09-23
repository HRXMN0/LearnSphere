import React, { useEffect } from 'react';
import { QuizSubmission } from '../../types/quiz';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';

interface Props {
  results: QuizSubmission;
  onRetakeQuiz: () => void;
  onNewQuiz: () => void;
}

export const QuizResults: React.FC<Props> = ({ 
  results, 
  onRetakeQuiz, 
  onNewQuiz 
}) => {
  const { navigateTo } = useApp();
  const { currentTopic, isDemoMode, documents, activeDocumentIds } = useLearning();

  const activeDoc = documents.find((d) => activeDocumentIds.includes(d.id));
  const evaluatedContext = isDemoMode
    ? 'Computer Networks — Unit 3 (Transport Layer)'
    : (currentTopic || activeDoc?.name || 'Uploaded Course Material');

  useEffect(() => {
    // Confetti only for high completion (70%+)
    if (results.percentage >= 70) {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.6 }
        });
      } catch (e) {
        console.log(e);
      }
    }
  }, [results.percentage]);

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E7E5DF] p-6 sm:p-8 shadow-elevated space-y-6 animate-slide-up select-none">
      {/* Header & Score Display */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-[#1A1A18] text-white flex items-center justify-center mx-auto shadow-soft font-serif font-bold text-2xl">
          <Trophy className="w-7 h-7 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold font-serif-display text-[#1A1A18] tracking-tight">
          Examination Results
        </h2>
        <p className="text-xs text-[#7A7973] font-mono">
          Evaluated against {evaluatedContext}
        </p>

        {/* Big Score Typography */}
        <div className="pt-2">
          <span className="text-5xl sm:text-6xl font-black font-serif-display text-[#1A1A18] tracking-tight">
            {results.percentage}%
          </span>
          <p className="text-xs font-semibold text-[#5C5B56] mt-1 font-mono">
            {results.score} of {results.totalQuestions} Questions Correct
          </p>
        </div>
      </div>

      {/* Topics Practiced vs Weak Areas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {/* Demonstrated Mastery */}
        <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Topics Mastered</span>
          </div>
          <ul className="space-y-1.5 text-xs text-[#3D3D3A]">
            {results.strongTopics.map((topic, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="leading-snug">{topic}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weak Areas Detected */}
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider font-mono">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Review Recommended</span>
          </div>
          <ul className="space-y-1.5 text-xs text-[#3D3D3A]">
            {results.weakTopics.map((topic, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="leading-snug">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Grounded Revision Step */}
      <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E7E5DF] space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1A1A18]">
          <BookOpen className="w-4 h-4 text-cobalt-600" />
          <span>Recommended Revision Action</span>
        </div>
        <p className="text-xs text-[#5C5B56] leading-relaxed">
          {results.recommendedRevision[0]}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E0DED7]">
        <button
          onClick={onRetakeQuiz}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#5F6470]" />
          <span>Retry Quiz</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTo('analytics')}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium text-[#1F242E] bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#1E3A8A]" />
            <span>Learning Insights</span>
          </button>

          <button
            onClick={onNewQuiz}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-medium text-white bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] border border-[#161B22] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
          >
            <span>Generate Another Quiz</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
