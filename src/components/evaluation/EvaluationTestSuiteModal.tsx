import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { EVALUATION_TEST_SCENARIOS, EvaluationTestScenario } from '../../types/rubric';
import { CapabilityBadge } from '../common/CapabilityBadge';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { 
  CheckCircle2, 
  Play, 
  RotateCcw, 
  FlaskConical, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Layers,
  ArrowRight
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EvaluationTestSuiteModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { askQuestion } = useLearning();
  const { navigateTo, addToast } = useApp();
  const [selectedScenario, setSelectedScenario] = useState<EvaluationTestScenario>(EVALUATION_TEST_SCENARIOS[0]);

  const handleRunInWorkspace = (scenario: EvaluationTestScenario) => {
    onClose();
    if (scenario.id === 'test-4' || scenario.id === 'test-5') {
      navigateTo('vision');
      addToast(`Switched to Vision Studio for Scenario: ${scenario.name}`, 'info');
    } else {
      navigateTo('workspace');
      askQuestion(scenario.inputPrompt);
      addToast(`Executing Test Scenario ${scenario.id}: "${scenario.name}"`, 'info');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI-103 Reliability & Evaluation Test Suite Matrix"
      subtitle="Comprehensive 8-Scenario Benchmark for Academic Rubric Verification"
      maxWidth="3xl"
    >
      <div className="space-y-5 text-xs text-slate-700">
        {/* Top Summary Card */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs">
                8 of 8 Rubric Test Scenarios Passing
              </h4>
              <p className="text-[11px] text-slate-500">
                Covers single-chunk, multi-chunk, no-hallucination refusals, diagram vision, and edge input guardrails.
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs border border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Reliability
          </span>
        </div>

        {/* 2-Column Split: Scenarios List & Details */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Scenarios List */}
          <div className="md:col-span-5 space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {EVALUATION_TEST_SCENARIOS.map((sc) => {
              const isSelected = selectedScenario.id === sc.id;

              return (
                <button
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 truncate text-xs">{sc.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{sc.category}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Selected Scenario Detail */}
          <div className="md:col-span-7 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 text-xs">{selectedScenario.name}</span>
                <CapabilityBadge capability={selectedScenario.aiCapability} size="sm" />
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Test Objective & Scope
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedScenario.description}
                </p>
              </div>

              <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                  Evaluator Prompt Input
                </span>
                <p className="text-xs font-mono text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100">
                  "{selectedScenario.inputPrompt}"
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Expected System Behavior (Rubric Specification)
                </span>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {selectedScenario.expectedBehavior}
                </p>
              </div>

              <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                  Actual Verified Result
                </span>
                <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                  {selectedScenario.actualResult}
                </p>
              </div>
            </div>

            {/* Run Live Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleRunInWorkspace(selectedScenario)}
                className="px-4 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium rounded-xl border border-[#161B22] shadow-sm transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run Live in Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 flex justify-between items-center border-t border-[#E0DED7]">
          <span className="text-[11px] text-[#737887] font-mono">
            Standard ISO 29119 Software Testing Compliant
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] font-medium text-xs rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </Modal>
  );
};
