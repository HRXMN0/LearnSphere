import React from 'react';
import { useApp, NavigationScreen } from '../../context/AppContext';
import { 
  Home, 
  FolderGit2, 
  BookOpen, 
  MessageSquare, 
  Eye, 
  HelpCircle,
  GraduationCap
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { currentScreen, navigateTo } = useApp();

  const items: { screen: NavigationScreen; label: string; icon: React.ElementType }[] = [
    { screen: 'landing', label: 'Home', icon: Home },
    { screen: 'workspace', label: 'Ask', icon: MessageSquare },
    { screen: 'classroom', label: 'Live Class', icon: GraduationCap },
    { screen: 'documents', label: 'Library', icon: FolderGit2 },
    { screen: 'document-view', label: 'Study', icon: BookOpen },
    { screen: 'vision', label: 'Vision', icon: Eye },
    { screen: 'quiz', label: 'Practice', icon: HelpCircle },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E0DED7] px-2 py-1 flex items-center justify-around select-none shadow-elevated safe-area-bottom"
      aria-label="Mobile Navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentScreen === item.screen;

        return (
          <button
            key={item.screen}
            onClick={() => navigateTo(item.screen)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20 ${
              isActive
                ? 'text-[#1F242E] font-semibold'
                : 'text-[#5F6470] hover:text-[#1F242E] font-medium'
            }`}
          >
            <div className={`p-1 rounded-lg transition-transform ${isActive ? 'bg-[#F2F0E8] border border-[#D4D2C9] scale-105 shadow-xs' : ''}`}>
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#1E3A8A]' : 'text-[#5F6470]'}`} />
            </div>
            <span className="mt-0.5 tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
