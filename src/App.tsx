import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LearningProvider } from './context/LearningContext';
import { AppShell } from './components/layout/AppShell';
import { LandingPage } from './components/landing/LandingPage';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { DocumentLibrary } from './components/documents/DocumentLibrary';
import { DocumentStudyView } from './components/documents/DocumentStudyView';
import { VisionView } from './components/vision/VisionView';
import { QuizGeneratorView } from './components/quiz/QuizGeneratorView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { AIStudyClassView } from './components/classroom/AIStudyClassView';

const MainContent: React.FC = () => {
  const { currentScreen } = useApp();

  switch (currentScreen) {
    case 'landing':
      return <LandingPage />;
    case 'workspace':
      return <WorkspaceView />;
    case 'classroom':
      return <AIStudyClassView />;
    case 'documents':
      return <DocumentLibrary />;
    case 'document-view':
      return <DocumentStudyView />;
    case 'vision':
      return <VisionView />;
    case 'quiz':
      return <QuizGeneratorView />;
    case 'analytics':
      return <AnalyticsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <LandingPage />;
  }
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <LearningProvider>
        <AppShell>
          <MainContent />
        </AppShell>
      </LearningProvider>
    </AppProvider>
  );
};

export default App;
