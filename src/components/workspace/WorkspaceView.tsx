import React, { useState } from 'react';
import { KnowledgeSidebar } from './KnowledgeSidebar';
import { ChatStream } from './ChatStream';
import { ContextPanel } from './ContextPanel';
import { SourcePreviewModal } from './SourcePreviewModal';
import { DocumentUploadModal } from '../documents/DocumentUploadModal';
import { Layers, Compass } from 'lucide-react';

export const WorkspaceView: React.FC = () => {
  const [mobileShowLeft, setMobileShowLeft] = useState(false);
  const [mobileShowRight, setMobileShowRight] = useState(false);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative">
      {/* Mobile panel toggle bar */}
      <div className="lg:hidden flex items-center justify-between px-3 py-1.5 bg-white border-b border-slate-200 text-xs text-slate-600">
        <button
          onClick={() => {
            setMobileShowLeft(!mobileShowLeft);
            setMobileShowRight(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            mobileShowLeft ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Materials ({mobileShowLeft ? 'Hide' : 'Show'})</span>
        </button>

        <button
          onClick={() => {
            setMobileShowRight(!mobileShowRight);
            setMobileShowLeft(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            mobileShowRight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Context ({mobileShowRight ? 'Hide' : 'Show'})</span>
        </button>
      </div>

      {/* 3-Column Core Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Materials / Knowledge Panel */}
        <div className={`h-full ${mobileShowLeft ? 'fixed inset-y-14 left-0 z-40 shadow-2xl flex' : 'hidden lg:flex'}`}>
          <KnowledgeSidebar />
        </div>

        {/* Center: AI Conversation Stream (Primary Focus) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <ChatStream />
        </div>

        {/* Right: Learning Context Panel */}
        <div className={`h-full ${mobileShowRight ? 'fixed inset-y-14 right-0 z-40 shadow-2xl flex' : 'hidden xl:flex'}`}>
          <ContextPanel />
        </div>
      </div>

      {/* Source Preview Inspector Modal */}
      <SourcePreviewModal />

      {/* Document Upload Multi-step Modal */}
      <DocumentUploadModal />
    </div>
  );
};
