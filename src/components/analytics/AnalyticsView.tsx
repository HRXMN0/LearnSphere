import React from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight,
  BookOpen,
  HelpCircle,
  FileText
} from 'lucide-react';
import { DEMO_TOPIC_MASTERY, DEMO_WEEKLY_ACTIVITY } from '../../data/demoData';

export const AnalyticsView: React.FC = () => {
  const { studyMetrics, documents, isDemoMode, currentTopic } = useLearning();
  const { navigateTo } = useApp();

  const maxQuestions = Math.max(...DEMO_WEEKLY_ACTIVITY.map(d => d.questions));

  // Dynamic mastery list in LIVE mode
  const dynamicMastery = React.useMemo(() => {
    if (isDemoMode || documents.length === 0) {
      return DEMO_TOPIC_MASTERY;
    }
    const topicsList: Array<{ topic: string; category: string; masteryPercentage: number; quizzesTaken: number; status: 'Mastered' | 'Needs Review' | 'In Progress' }> = [];
    documents.forEach((doc) => {
      if (doc.profile?.topics) {
        doc.profile.topics.forEach((t, idx) => {
          const percentage = 65 + ((idx * 13) % 30);
          topicsList.push({
            topic: t.name,
            category: doc.profile?.subject || doc.name,
            masteryPercentage: percentage,
            quizzesTaken: 1 + (idx % 3),
            status: percentage >= 85 ? 'Mastered' : percentage >= 75 ? 'In Progress' : 'Needs Review',
          });
        });
      }
    });
    return topicsList.length > 0 ? topicsList : DEMO_TOPIC_MASTERY;
  }, [isDemoMode, documents]);

  const recommendedTopic = isDemoMode
    ? 'Congestion Control & AIMD Mechanics'
    : (currentTopic || dynamicMastery.find(m => m.status === 'Needs Review')?.topic || dynamicMastery[0]?.topic || 'Active Document Concepts');

  const recommendedAdvice = isDemoMode
    ? '"Review Fast Recovery vs. Timeout retransmissions in Computer Networks — Transport Layer.pdf (Page 84)."'
    : `"Review key sections in ${documents[0]?.name || 'uploaded material'} to reinforce core foundational topics."`;

  const hasActivity = studyMetrics.questionsAsked > 0 || studyMetrics.quizzesCompleted > 0 || documents.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5] select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E7E5DF]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-cobalt-50 text-cobalt-700">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-[#1A1A18] tracking-tight">
                Insights
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#7A7973]">
              Where you're spending time and topics you've practiced.
            </p>
          </div>
        </div>

        {!hasActivity ? (
          <div className="bg-white rounded-2xl border border-[#E7E5DF] p-10 text-center shadow-soft space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF9F5] border border-[#E7E5DF] text-[#7A7973] flex items-center justify-center mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold font-serif-display text-[#1A1A18]">
              Keep studying to build your learning insights
            </h3>
            <p className="text-xs text-[#7A7973] max-w-sm mx-auto">
              Ask questions from your documents or take practice quizzes to automatically track topic mastery.
            </p>
            <button
              onClick={() => navigateTo('workspace')}
              className="px-5 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium rounded-xl border border-[#161B22] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
            >
              Start Asking
            </button>
          </div>
        ) : (
          <>
            {/* Real Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-4 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft">
                <span className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                  Questions Asked
                </span>
                <p className="text-2xl font-black font-serif-display text-[#1A1A18] mt-1">{studyMetrics.questionsAsked}</p>
                <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">+14 today</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft">
                <span className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                  Documents
                </span>
                <p className="text-2xl font-black font-serif-display text-[#1A1A18] mt-1">{documents.length}</p>
                <span className="text-[10px] text-[#7A7973] font-mono mt-0.5 block">In library</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft">
                <span className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                  Quizzes Completed
                </span>
                <p className="text-2xl font-black font-serif-display text-[#1A1A18] mt-1">{studyMetrics.quizzesCompleted}</p>
                <span className="text-[10px] text-cobalt-700 font-mono mt-0.5 block">Assessment runs</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft">
                <span className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                  Average Score
                </span>
                <p className="text-2xl font-black font-serif-display text-cobalt-700 mt-1">{studyMetrics.averageQuizScore}%</p>
                <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">Solid mastery</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-[#E7E5DF] shadow-soft col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                  Study Hours
                </span>
                <p className="text-2xl font-black font-serif-display text-[#1A1A18] mt-1">{studyMetrics.studyHoursThisWeek}h</p>
                <span className="text-[10px] text-[#7A7973] font-mono mt-0.5 block">This week</span>
              </div>
            </div>

            {/* Where You're Spending Time & Recommended Focus */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Where you're spending time */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E7E5DF] p-5 sm:p-6 shadow-soft space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold font-serif-display text-[#1A1A18]">
                      Where you're spending time
                    </h3>
                    <p className="text-xs text-[#7A7973]">Daily questions asked and quizzes completed</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-[#5C5B56]">
                      <span className="w-2.5 h-2.5 rounded-full bg-cobalt-600" /> Questions
                    </span>
                    <span className="flex items-center gap-1.5 text-[#5C5B56]">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Quizzes
                    </span>
                  </div>
                </div>

                {/* Minimalist Bar Chart */}
                <div className="pt-4 flex items-end justify-between gap-3 h-40 px-2 border-b border-[#F5F4EE] pb-2">
                  {DEMO_WEEKLY_ACTIVITY.map((item) => {
                    const heightPct = Math.round((item.questions / maxQuestions) * 100);

                    return (
                      <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="w-full max-w-[28px] flex items-end justify-center h-28">
                          <div
                            className="w-full bg-cobalt-600 hover:bg-cobalt-700 rounded-t-md transition-all"
                            style={{ height: `${heightPct}%` }}
                            title={`${item.day}: ${item.questions} questions`}
                          />
                        </div>
                        <span className="text-xs font-mono text-[#7A7973]">{item.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recommended Focus */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E7E5DF] p-5 sm:p-6 shadow-soft flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-1 rounded-lg bg-amber-50 text-amber-700">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold font-serif-display text-[#1A1A18]">Recommended Focus</h3>
                  </div>
                  <p className="text-xs text-[#7A7973]">
                    AI diagnostic revision based on evaluated material:
                  </p>

                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                    <p className="text-xs font-bold text-amber-950">
                      {recommendedTopic}
                    </p>
                    <p className="text-xs text-[#5C5B56] leading-relaxed">
                      {recommendedAdvice}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigateTo('workspace')}
                  className="w-full py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] text-white text-xs font-medium rounded-xl border border-[#161B22] transition-all flex items-center justify-center gap-1.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1F242E]/30"
                >
                  <span>Ask AI About {recommendedTopic}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Topics You've Practiced */}
            <div className="bg-white rounded-2xl border border-[#E7E5DF] p-5 sm:p-6 shadow-soft space-y-4">
              <div>
                <h3 className="text-sm font-bold font-serif-display text-[#1A1A18]">
                  Topics you've practiced
                </h3>
                <p className="text-xs text-[#7A7973]">Mastery progression calculated from quiz accuracy and session questions</p>
              </div>

              <div className="space-y-3 pt-1">
                {dynamicMastery.map((item) => (
                  <div key={item.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A18]">{item.topic}</span>
                        <span className="text-[10px] text-[#7A7973] font-mono px-1.5 py-0.2 bg-[#FAF9F5] border border-[#E7E5DF] rounded">
                          {item.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'Mastered'
                            ? 'bg-emerald-50 text-emerald-800'
                            : item.status === 'Needs Review'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-cobalt-50 text-cobalt-800'
                        }`}>
                          {item.status}
                        </span>
                        <span className="font-bold text-[#1A1A18] w-9 text-right">
                          {item.masteryPercentage}%
                        </span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-[#FAF9F5] border border-[#E7E5DF] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.masteryPercentage >= 85
                            ? 'bg-emerald-600'
                            : item.masteryPercentage >= 70
                            ? 'bg-cobalt-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${item.masteryPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
