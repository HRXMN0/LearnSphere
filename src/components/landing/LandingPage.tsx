import React from 'react';
import { useApp } from '../../context/AppContext';
import { useLearning } from '../../context/LearningContext';
import { 
  ArrowRight, 
  Plus, 
  MessageSquare, 
  FileText, 
  BookOpen, 
  HelpCircle, 
  CheckCircle2, 
  Sparkles, 
  Clock, 
  Eye, 
  Database,
  Layers,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { CapabilityBadge } from '../common/CapabilityBadge';

export const LandingPage: React.FC = () => {
  const { navigateTo, openDocumentStudy } = useApp();
  const { 
    documents, 
    activeDocumentIds, 
    currentTopic, 
    chatMessages, 
    setUploadDocumentModalOpen,
    studyMetrics 
  } = useLearning();

  const activeDoc = documents.find((d) => activeDocumentIds.includes(d.id)) || documents[0];
  const lastUserMsg = [...chatMessages].reverse().find((m) => m.role === 'user');

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF9F5] select-none">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Editorial Hero Section */}
        <section className="text-center space-y-4 pt-4 sm:pt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D4D2C9] text-[#5F6470] text-xs font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#1E3A8A] animate-pulse" />
            <span>LearnSphere · AI Academic Learning Workspace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-serif-display text-[#1F242E] tracking-tight max-w-2xl mx-auto leading-tight">
            Learn from everything.
          </h1>

          <p className="text-sm sm:text-base text-[#5F6470] max-w-xl mx-auto leading-relaxed">
            Your AI-powered academic learning workspace. Ask questions, understand diagrams, and practice directly from your study material.
          </p>

          {/* Primary & Secondary Action CTAs */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setUploadDocumentModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-semibold border border-[#161B22] shadow-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>+ Upload material</span>
            </button>

            <button
              onClick={() => navigateTo('workspace')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#1E3A8A] text-xs font-semibold border border-indigo-200 shadow-xs transition-colors duration-150"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>Ask</span>
            </button>

            <button
              onClick={() => navigateTo('classroom')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold border border-amber-200 shadow-xs transition-colors duration-150"
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-800" />
              <span>AI Live Class</span>
            </button>
          </div>
        </section>

        {/* Dual Learning Modes Highlight */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode 1: Ask */}
          <div
            onClick={() => navigateTo('workspace')}
            className="p-5 bg-white rounded-2xl border border-[#D4D2C9] hover:border-[#1E3A8A] hover:bg-[#FAF9F5] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-[#1E3A8A] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FAF9F5] border border-[#D4D2C9] text-[#5F6470]">
                Student-Driven Study
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-display text-[#1F242E] group-hover:text-[#1E3A8A] transition-colors">
                Ask
              </h3>
              <p className="text-xs text-[#5F6470] leading-relaxed mt-1">
                Ask anything about your study material. Get grounded explanations, key takeaways, diagrams, quizzes, and verified citations.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] pt-1">
              <span>Start Asking</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* Mode 2: AI Live Class */}
          <div
            onClick={() => navigateTo('classroom')}
            className="p-5 bg-white rounded-2xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50/20 shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 border border-rose-300 text-rose-700 animate-pulse">
                ● Live Classroom
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold font-serif-display text-[#1F242E] group-hover:text-amber-900 transition-colors">
                AI Live Class
              </h3>
              <p className="text-xs text-[#5F6470] leading-relaxed mt-1">
                Attend a private class with an AI teacher who explains your material, creates notes, and responds naturally while teaching.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 pt-1">
              <span>Join 1-to-1 Private Class</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </section>

        {/* Continue Learning Area */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#5F6470] uppercase tracking-wider font-mono">
              Continue Learning
            </h2>
            <span className="text-[11px] text-[#737887] font-mono">Real Activity Session</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Recently opened document */}
            <div 
              onClick={() => activeDoc && openDocumentStudy(activeDoc.id)}
              className="p-4 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between text-[#737887]">
                <span className="text-[10px] uppercase font-mono font-bold text-[#5F6470]">Recent Document</span>
                <Clock className="w-3.5 h-3.5 text-[#737887]" />
              </div>
              <p className="text-xs font-semibold text-[#1F242E] truncate group-hover:text-[#1E3A8A]">
                {activeDoc?.name || 'No document opened yet'}
              </p>
              <p className="text-[11px] text-[#737887]">
                {activeDoc ? `${activeDoc.pages} pages · Study Workspace` : 'Upload to start'}
              </p>
            </div>

            {/* 2. Last question asked */}
            <div 
              onClick={() => navigateTo('workspace')}
              className="p-4 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between text-[#737887]">
                <span className="text-[10px] uppercase font-mono font-bold text-[#5F6470]">Last Question</span>
                <MessageSquare className="w-3.5 h-3.5 text-[#1E3A8A]" />
              </div>
              <p className="text-xs font-semibold text-[#1F242E] line-clamp-1 group-hover:text-[#1E3A8A]">
                {lastUserMsg ? `"${lastUserMsg.content}"` : '"What is TCP vs UDP?"'}
              </p>
              <p className="text-[11px] text-[#1E3A8A] font-medium flex items-center gap-1">
                <span>Resume in Ask Workspace</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </p>
            </div>

            {/* 3. Current learning activity */}
            <div 
              onClick={() => navigateTo('workspace')}
              className="p-4 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between text-[#737887]">
                <span className="text-[10px] uppercase font-mono font-bold text-[#5F6470]">Current Focus</span>
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-[#1F242E] truncate">
                {currentTopic || 'Computer Networks'}
              </p>
              <p className="text-[11px] text-[#737887]">
                {studyMetrics.questionsAsked} questions asked today
              </p>
            </div>

            {/* 4. Recently generated quiz */}
            <div 
              onClick={() => navigateTo('quiz')}
              className="p-4 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
            >
              <div className="flex items-center justify-between text-[#737887]">
                <span className="text-[10px] uppercase font-mono font-bold text-[#5F6470]">Practice Assessment</span>
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <p className="text-xs font-semibold text-[#1F242E] truncate group-hover:text-amber-900">
                {studyMetrics.quizzesCompleted > 0 ? `${studyMetrics.averageQuizScore}% Average Score` : 'Generate 5-Question Quiz'}
              </p>
              <p className="text-[11px] text-amber-900 font-medium">
                Launch Practice Exam →
              </p>
            </div>
          </div>
        </section>

        {/* Your Library - Refined Document List */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#5F6470] uppercase tracking-wider font-mono">
              Your Library
            </h2>
            <button
              onClick={() => navigateTo('documents')}
              className="text-xs text-[#1E3A8A] hover:text-[#172554] font-semibold flex items-center gap-1 focus-visible:outline-none focus-visible:underline"
            >
              <span>View all ({documents.length})</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-white rounded-xl border border-[#D4D2C9] divide-y divide-[#E7E5DF] shadow-xs overflow-hidden">
            {documents.slice(0, 4).map((doc, idx) => {
              const lastStudied = idx === 0 ? 'Last studied 12 min ago' : idx === 1 ? 'Last studied yesterday' : 'Studied this week';
              return (
                <div
                  key={doc.id}
                  onClick={() => openDocumentStudy(doc.id)}
                  className="flex items-center justify-between p-4 hover:bg-[#F2F0E8]/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF9F5] border border-[#D4D2C9] flex items-center justify-center flex-shrink-0 text-[#1E3A8A]">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-[#1F242E] truncate group-hover:text-[#1E3A8A]">
                        {doc.name}
                      </h3>
                      <p className="text-[11px] text-[#737887] mt-0.5">
                        <span className="uppercase font-mono font-medium text-[#5F6470]">{doc.type}</span> · {doc.pages} pages · <span className="text-[#1F242E]">{lastStudied}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="hidden sm:inline-block text-[11px] text-[#1E3A8A] font-semibold group-hover:underline">
                      Open Study Workspace →
                    </span>
                    <ArrowRight className="w-4 h-4 text-[#737887] group-hover:text-[#1E3A8A] transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Three Core Workspaces Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#D4D2C9]">
          {/* Ask */}
          <div 
            onClick={() => navigateTo('workspace')}
            className="p-5 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold font-serif-display text-[#1F242E] group-hover:text-[#1E3A8A]">
              Grounded AI Answers
            </h3>
            <p className="text-xs text-[#5F6470] leading-relaxed">
              Ask questions about your learning material. Inspect verifiable citations and chunk excerpts directly from your documents.
            </p>
          </div>

          {/* Vision Studio */}
          <div 
            onClick={() => navigateTo('vision')}
            className="p-5 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold font-serif-display text-[#1F242E] group-hover:text-indigo-900">
              Multimodal Vision
            </h3>
            <p className="text-xs text-[#5F6470] leading-relaxed">
              Upload architecture diagrams or lecture notes. AI detects components, step sequences, and labels with interactive zoom.
            </p>
          </div>

          {/* Practice Quizzes */}
          <div 
            onClick={() => navigateTo('quiz')}
            className="p-5 bg-white rounded-xl border border-[#D4D2C9] hover:border-[#BDB9AC] shadow-xs hover:shadow-soft transition-all cursor-pointer space-y-2 group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold font-serif-display text-[#1F242E] group-hover:text-amber-900">
              Dynamic Practice
            </h3>
            <p className="text-xs text-[#5F6470] leading-relaxed">
              Generate exams and quizzes directly from your syllabus with immediate explanations and diagnostic mastery scoring.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
