import React from 'react';
import { AICapability } from '../../types/chat';
import { Eye, Database, Sparkles } from 'lucide-react';

interface Props {
  capability: AICapability;
  size?: 'sm' | 'md';
}

export const CapabilityBadge: React.FC<Props> = ({ capability, size = 'sm' }) => {
  const isSm = size === 'sm';

  switch (capability) {
    case 'RAG GROUNDED':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Answer verified and grounded in your uploaded documents"
        >
          <Database className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>GROUNDED</span>
        </span>
      );
    case 'VISION':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Multimodal visual intelligence analysis"
        >
          <Eye className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>VISION</span>
        </span>
      );
    case 'GENERATIVE AI':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 ${
            isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
          title="Generative educational synthesis"
        >
          <Sparkles className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          <span>GENERATIVE AI</span>
        </span>
      );
  }
};
