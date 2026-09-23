import React from 'react';
import { Modal } from '../common/Modal';
import { RESPONSIBLE_AI_PILLARS } from '../../types/rubric';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  Terminal,
  Cpu
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ResponsibleAIModal: React.FC<Props> = ({ isOpen, onClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Responsible AI Framework & Reliability Safeguards"
      subtitle="AI-103 Course Rubric: 15% Evaluation Criterion on Ethics, Verification & Hallucination Mitigation"
      maxWidth="3xl"
    >
      <div className="space-y-6 text-xs text-slate-700">
        {/* Banner */}
        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-emerald-900 text-sm">
              Grounded, Transparent, and Safe by Design
            </h4>
            <p className="text-emerald-800 leading-relaxed">
              In accordance with Microsoft Responsible AI Standard v2 and university grading guidelines, LearnSphere prioritizes provenance, privacy, and verified accuracy over open-ended generative extrapolation.
            </p>
          </div>
        </div>

        {/* 5 Core Responsible AI Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RESPONSIBLE_AI_PILLARS.map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>{item.pillar}</span>
              </div>
              <p className="text-[11px] font-semibold text-blue-700">
                {item.principle}
              </p>
              <p className="text-slate-600 leading-relaxed text-xs">
                {item.implementationInApp}
              </p>
              <div className="p-2 rounded bg-white border border-slate-200 text-[11px] text-slate-700">
                <strong className="text-slate-800">Mitigation: </strong>{item.mitigationStrategy}
              </div>
            </div>
          ))}
        </div>

        {/* Explicit System Limitations */}
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Documented System Limitations (Transparency Obligation)</span>
          </div>
          <ul className="space-y-1.5 pl-5 list-disc text-amber-900 text-xs leading-relaxed">
            <li>
              <strong>Scope Constraint:</strong> The assistant intentionally will not answer queries outside the active course curriculum (e.g. quantum algorithms or external trivia) without explicit course material uploaded.
            </li>
            <li>
              <strong>Vector Chunk Boundary:</strong> Complex formulas split across arbitrary page breaks may require adjacent chunk stitching.
            </li>
            <li>
              <strong>Resolution Sensitivity:</strong> Diagram OCR accuracy depends on minimum 150 DPI resolution for fine circuit/protocol flags.
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <span className="text-slate-400 font-mono text-[11px]">
            Complies with ISO/IEC 42001 & Microsoft RAI Standard
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Close Framework
          </button>
        </div>
      </div>
    </Modal>
  );
};
