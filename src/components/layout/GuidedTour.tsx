import React from 'react';
import { useApp, GUIDED_TOUR_STEPS } from '../../context/AppContext';
import { Compass, ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';

export const GuidedTour: React.FC = () => {
  const { 
    isGuidedTourActive, 
    currentTourStep, 
    nextTourStep, 
    prevTourStep, 
    closeGuidedTour 
  } = useApp();

  if (!isGuidedTourActive) return null;

  const step = GUIDED_TOUR_STEPS[currentTourStep];
  const isLast = currentTourStep === GUIDED_TOUR_STEPS.length - 1;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-slide-up select-none">
      <div className="bg-slate-900 text-white rounded-xl shadow-elevated border border-slate-700/80 p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              Evaluator Walkthrough • Step {step.stepNumber} of {GUIDED_TOUR_STEPS.length}
            </span>
          </div>
          <button
            onClick={closeGuidedTour}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            title="Dismiss Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h4 className="text-sm font-semibold text-white mb-1">
          {step.title}
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          {step.description}
        </p>

        <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 mb-3 flex items-center gap-2 text-xs text-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span><strong className="text-white">Try this:</strong> {step.actionHint}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex gap-1">
            {GUIDED_TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-1.5 rounded-full transition-all ${
                  idx === currentTourStep ? 'bg-indigo-400 w-4' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentTourStep > 0 && (
              <button
                onClick={prevTourStep}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
            )}

            <button
              onClick={nextTourStep}
              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
            >
              <span>{isLast ? 'Complete' : 'Next Step'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
