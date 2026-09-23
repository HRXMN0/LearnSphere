import React, { createContext, useContext, useState, ReactNode } from 'react';

export type NavigationScreen = 
  | 'landing' 
  | 'workspace' 
  | 'classroom'
  | 'vision' 
  | 'quiz' 
  | 'documents' 
  | 'document-view'
  | 'analytics' 
  | 'settings';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface GuidedTourStep {
  stepNumber: number;
  title: string;
  description: string;
  targetScreen: NavigationScreen;
  actionHint: string;
}

export const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  {
    stepNumber: 1,
    title: 'P0 AI Workspace & RAG',
    description: 'Explore the 3-column learning workspace and ask "What is the difference between TCP and UDP?" to see grounded retrieval.',
    targetScreen: 'workspace',
    actionHint: 'Click a preset prompt or type a networking question.'
  },
  {
    stepNumber: 2,
    title: 'Source & RAG Inspection',
    description: 'Click any citation badge to visually examine the semantic chunk excerpt, page number, and retrieval score.',
    targetScreen: 'workspace',
    actionHint: 'Click "Computer Networks — Transport Layer.pdf · Page 42"'
  },
  {
    stepNumber: 3,
    title: 'Multimodal Vision Studio',
    description: 'Inspect the TCP Three-Way Handshake diagram to observe AI vision concept tagging, sequence breakdowns, and labels.',
    targetScreen: 'vision',
    actionHint: 'Click "Explain this diagram" or hover over diagram steps.'
  },
  {
    stepNumber: 4,
    title: 'Interactive Quiz Assessment',
    description: 'Generate a 5-question Transport Layer quiz, answer questions, and view explanations with source references.',
    targetScreen: 'quiz',
    actionHint: 'Select answers and submit to view diagnostic score.'
  },
  {
    stepNumber: 5,
    title: 'Study Analytics & Mastery',
    description: 'Check your study hours, question counts, topic mastery, and AI recommendations for exam revision.',
    targetScreen: 'analytics',
    actionHint: 'Review recommended focus areas for exam preparation.'
  }
];

interface AppContextType {
  currentScreen: NavigationScreen;
  navigateTo: (screen: NavigationScreen) => void;
  focusedDocumentId: string | null;
  openDocumentStudy: (docId: string) => void;
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
  isGuidedTourActive: boolean;
  currentTourStep: number;
  startGuidedTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  closeGuidedTour: () => void;
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentScreen, setCurrentScreen] = useState<NavigationScreen>('landing');
  const [focusedDocumentId, setFocusedDocumentId] = useState<string | null>(null);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  // Default to LIVE MODE per Directive 18 (Real Azure AI)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isGuidedTourActive, setIsGuidedTourActive] = useState<boolean>(false);
  const [currentTourStep, setCurrentTourStep] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Global Ctrl+K / Cmd+K listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (screen: NavigationScreen) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDocumentStudy = (docId: string) => {
    setFocusedDocumentId(docId);
    setCurrentScreen('document-view');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const startGuidedTour = () => {
    setIsGuidedTourActive(true);
    setCurrentTourStep(0);
    navigateTo(GUIDED_TOUR_STEPS[0].targetScreen);
  };

  const nextTourStep = () => {
    if (currentTourStep < GUIDED_TOUR_STEPS.length - 1) {
      const nextIdx = currentTourStep + 1;
      setCurrentTourStep(nextIdx);
      navigateTo(GUIDED_TOUR_STEPS[nextIdx].targetScreen);
    } else {
      setIsGuidedTourActive(false);
      addToast('Guided walkthrough completed! Feel free to explore freely.', 'success');
    }
  };

  const prevTourStep = () => {
    if (currentTourStep > 0) {
      const prevIdx = currentTourStep - 1;
      setCurrentTourStep(prevIdx);
      navigateTo(GUIDED_TOUR_STEPS[prevIdx].targetScreen);
    }
  };

  const closeGuidedTour = () => {
    setIsGuidedTourActive(false);
  };

  return (
    <AppContext.Provider
      value={{
        currentScreen,
        navigateTo,
        focusedDocumentId,
        openDocumentStudy,
        isGlobalSearchOpen,
        setIsGlobalSearchOpen,
        isDemoMode,
        setDemoMode: setIsDemoMode,
        isGuidedTourActive,
        currentTourStep,
        startGuidedTour,
        nextTourStep,
        prevTourStep,
        closeGuidedTour,
        toasts,
        addToast,
        removeToast,
        sidebarCollapsed,
        setSidebarCollapsed
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
