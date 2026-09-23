import React from 'react';
import { useApp, NavigationScreen } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';
import { 
  Home, 
  FolderGit2, 
  BookOpen, 
  MessageSquare, 
  Eye, 
  HelpCircle, 
  BarChart3, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Database,
  GraduationCap
} from 'lucide-react';
import { LearnSphereLogo } from '../common/LearnSphereLogo';

export const Sidebar: React.FC = () => {
  const { currentScreen, navigateTo, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { documents, activeDocumentIds } = useLearning();

  const navItems: { screen: NavigationScreen; label: string; icon: React.ElementType; badge?: string }[] = [
    { screen: 'landing', label: 'Home', icon: Home },
    { screen: 'workspace', label: 'Ask', icon: MessageSquare },
    { screen: 'classroom', label: 'AI Live Class', icon: GraduationCap, badge: 'Live' },
    { screen: 'documents', label: 'Library', icon: FolderGit2, badge: `${documents.length}` },
    { screen: 'document-view', label: 'Study Workspace', icon: BookOpen },
    { screen: 'vision', label: 'Vision Studio', icon: Eye },
    { screen: 'quiz', label: 'Practice', icon: HelpCircle },
    { screen: 'analytics', label: 'Insights', icon: BarChart3 },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-[#E0DED7] transition-all duration-250 ease-in-out z-20 select-none ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* Sidebar Brand Header */}
      <div className={`p-3 border-b border-[#E0DED7] flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-start'}`}>
        <button
          onClick={() => navigateTo('landing')}
          className={`flex items-center gap-2 text-left group focus:outline-none ${sidebarCollapsed ? 'justify-center' : ''}`}
          aria-label="LearnSphere home"
        >
          <LearnSphereLogo
            variant={sidebarCollapsed ? 'symbol' : 'full'}
            size={sidebarCollapsed ? 'sm' : 'sm'}
            showSubtitle={!sidebarCollapsed}
          />
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.screen;

          return (
            <button
              key={item.screen}
              onClick={() => navigateTo(item.screen)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all group relative focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20 ${
                isActive
                  ? 'bg-[#F2F0E8] text-[#1F242E] font-semibold border border-[#D4D2C9] shadow-xs'
                  : 'text-[#5F6470] hover:bg-[#FAF9F5] hover:text-[#1F242E] font-medium border border-transparent'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isActive ? 'text-[#1E3A8A]' : 'text-[#5F6470] group-hover:text-[#1F242E]'
                }`}
              />

              {!sidebarCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {!sidebarCollapsed && item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-medium ${
                    isActive
                      ? 'bg-white text-[#1F242E] border border-[#D4D2C9]'
                      : 'bg-[#FAF9F5] text-[#5F6470] border border-[#E0DED7]'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Tooltip on collapsed mode */}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 bg-[#1F242E] text-white text-[11px] rounded-lg shadow-elevated opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Knowledge Status Capsule */}
      {!sidebarCollapsed ? (
        <div className="p-3 m-2 bg-[#FAF9F5] rounded-xl border border-[#E0DED7] text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3 h-3 text-emerald-600" />
              Active Knowledge
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-[#5F6470]">
            <span className="font-semibold text-[#1F242E]">{activeDocumentIds.length}</span> of {documents.length} active in Azure Search.
          </p>
        </div>
      ) : (
        <div className="p-2 text-center" title="Azure AI Search active">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mx-auto block" />
        </div>
      )}

      {/* Settings at Bottom */}
      <div className="p-2 border-t border-[#E0DED7] space-y-1">
        <button
          onClick={() => navigateTo('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20 ${
            currentScreen === 'settings'
              ? 'bg-[#F2F0E8] text-[#1F242E] font-semibold border border-[#D4D2C9]'
              : 'text-[#5F6470] hover:bg-[#FAF9F5] hover:text-[#1F242E] font-medium border border-transparent'
          }`}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className={`w-4 h-4 flex-shrink-0 ${currentScreen === 'settings' ? 'text-[#1E3A8A]' : 'text-[#5F6470]'}`} />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>

        {/* Collapse toggle button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center p-1.5 text-[#5F6470] hover:text-[#1F242E] hover:bg-[#FAF9F5] rounded-lg text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-[#5F6470]">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
