import React, { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { GuidedTour } from './GuidedTour';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import { DocumentUploadModal } from '../documents/DocumentUploadModal';
import { useApp } from '../../context/AppContext';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FAF9F5] text-[#1A1A18] overflow-hidden font-sans">
      <TopBar />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto relative bg-[#FAF9F5] pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav />
      <GuidedTour />
      <GlobalSearchModal />
      <DocumentUploadModal />

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />,
            error: <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />,
            warning: <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />,
            info: <Info className="w-4 h-4 text-cobalt-600 flex-shrink-0" />,
          };

          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 bg-white rounded-xl shadow-elevated border border-[#E7E5DF] text-xs text-[#1A1A18] animate-slide-up"
            >
              {icons[toast.type]}
              <span className="flex-1 font-medium">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#7A7973] hover:text-[#1A1A18] p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
