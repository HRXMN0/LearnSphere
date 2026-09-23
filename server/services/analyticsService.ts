import fs from 'fs';
import path from 'path';
import { LearningEvent, InsightsData, TopicMastery, WeeklyActivityPoint, RecommendedFocus } from '../../src/types/analytics';
import { getMasteryStatus } from '../../src/utils/mastery';
import { ragPipeline } from './ragPipeline';
import { QuizQuestion, QuizSubmission } from '../../src/types/quiz';

const MAX_SESSION_DURATION_SECONDS = 7200; // 2 hours sanity cap per session

export class AnalyticsService {
  private storageFile: string;
  private events: LearningEvent[] = [];
  private eventIds: Set<string> = new Set();
  private writePromise: Promise<void> = Promise.resolve();

  constructor() {
    const storageDir = path.join(process.cwd(), 'server', 'storage');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.storageFile = path.join(storageDir, 'learning_activity.json');
    this.loadEvents();
  }

  /**
   * Safe synchronous loader on server startup
   */
  private loadEvents(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.events = parsed;
          this.eventIds = new Set(parsed.map((e: LearningEvent) => e.id));
        }
      }
    } catch (err) {
      console.warn('[AnalyticsService] Could not read learning_activity.json:', err);
      this.events = [];
      this.eventIds = new Set();
    }
  }

  /**
   * Concurrency-safe atomic serialization
   */
  private async persistEvents(): Promise<void> {
    this.writePromise = this.writePromise.then(async () => {
      try {
        const tmpFile = `${this.storageFile}.tmp`;
        const data = JSON.stringify(this.events, null, 2);
        fs.writeFileSync(tmpFile, data, 'utf-8');
        fs.renameSync(tmpFile, this.storageFile);
      } catch (err) {
        console.error('[AnalyticsService] Atomic write error:', err);
      }
    });
    return this.writePromise;
  }

  /**
   * Records an event idempotently.
   * Returns true if newly recorded, false if already recorded.
   */
  async recordEvent(event: LearningEvent): Promise<boolean> {
    if (!event.id || this.eventIds.has(event.id)) {
      return false; // Idempotent skip
    }

    // Sanity check for session durations
    if (event.type === 'study_session_ended' || event.type === 'live_class_ended') {
      const dur = Number(event.metadata?.durationSeconds || 0);
      if (isNaN(dur) || dur <= 0) {
        return false;
      }
      if (dur > MAX_SESSION_DURATION_SECONDS) {
        event.metadata = {
          ...event.metadata,
          durationSeconds: MAX_SESSION_DURATION_SECONDS,
          uncappedDurationSeconds: dur,
        };
      }
    }

    this.eventIds.add(event.id);
    this.events.push(event);
    await this.persistEvents();
    return true;
  }

  /**
   * Authoritative server-side evaluation of quiz submissions.
   * Records the quiz_completed event directly from verified scoring logic.
   */
  async evaluateAndRecordQuiz(
    quizId: string,
    documentId: string | undefined,
    topic: string,
    userAnswers: { [questionId: string]: number },
    questions: QuizQuestion[]
  ): Promise<QuizSubmission> {
    let score = 0;
    const weakTopics: string[] = [];
    const strongTopics: string[] = [];

    // Track per-topic question results
    const topicBreakdown: { [subTopic: string]: { total: number; correct: number } } = {};

    questions.forEach((q) => {
      const subTopic = q.sourceReference?.topic || topic || 'General Concept';
      if (!topicBreakdown[subTopic]) {
        topicBreakdown[subTopic] = { total: 0, correct: 0 };
      }
      topicBreakdown[subTopic].total++;

      const selected = userAnswers[q.id];
      if (selected === q.correctAnswerIndex) {
        score++;
        topicBreakdown[subTopic].correct++;
        if (!strongTopics.includes(subTopic)) {
          strongTopics.push(subTopic);
        }
      } else {
        if (!weakTopics.includes(subTopic)) {
          weakTopics.push(subTopic);
        }
      }
    });

    const percentage = Math.round((score / Math.max(1, questions.length)) * 100);
    const recommendedRevision = weakTopics.length > 0
      ? weakTopics.map((t) => `Review "${t}" in your uploaded course materials.`)
      : ['Strong performance across all evaluated topics!'];

    const submission: QuizSubmission = {
      quizId,
      totalQuestions: questions.length,
      score,
      percentage,
      userAnswers,
      weakTopics: weakTopics.length > 0 ? weakTopics : ['None detected - flawless run!'],
      strongTopics,
      recommendedRevision,
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Record trusted quiz_completed event
    const eventId = `evt_quiz_${quizId}`;
    await this.recordEvent({
      id: eventId,
      type: 'quiz_completed',
      timestamp: new Date().toISOString(),
      documentId,
      topic,
      metadata: {
        quizId,
        score,
        totalQuestions: questions.length,
        percentage,
        topicBreakdown,
        weakTopics: submission.weakTopics,
        strongTopics: submission.strongTopics,
      },
    });

    return submission;
  }

  /**
   * Computes real-time dynamic Insights from persisted events and live document registry.
   */
  async getInsights(): Promise<InsightsData> {
    const docs = await ragPipeline.getDocuments();
    const activeDocMap = new Map(docs.map((d) => [d.id, d]));

    const now = new Date();
    const todayStr = this.toDateString(now);

    // 1. Questions Asked
    const questionEvents = this.events.filter((e) => e.type === 'question_submitted');
    const questionsAsked = questionEvents.length;
    const questionsToday = questionEvents.filter(
      (e) => this.toDateString(new Date(e.timestamp)) === todayStr
    ).length;

    // 2. Documents
    const documents = docs.length;
    const indexedDocuments = docs.filter((d) => d.status === 'ready' && d.chunksCount > 0).length;

    // 3. Quizzes Completed & Average Score
    const quizEvents = this.events.filter((e) => e.type === 'quiz_completed');
    const quizzesCompleted = quizEvents.length;
    let averageScore: number | null = null;
    if (quizzesCompleted > 0) {
      const sumPercentage = quizEvents.reduce(
        (sum, q) => sum + Number(q.metadata?.percentage || 0),
        0
      );
      averageScore = Math.round(sumPercentage / quizzesCompleted);
    }

    // 4. Study Hours (from completed sessions & classes with 2hr sanity cap)
    const sessionEvents = this.events.filter(
      (e) => e.type === 'study_session_ended' || e.type === 'live_class_ended'
    );
    const totalDurationSeconds = sessionEvents.reduce(
      (sum, s) => sum + Math.min(MAX_SESSION_DURATION_SECONDS, Math.max(0, Number(s.metadata?.durationSeconds || 0))),
      0
    );
    const studyHours = Math.round((totalDurationSeconds / 3600) * 10) / 10;

    // Study hours this week (last 7 days including today)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const weekDurationSeconds = sessionEvents
      .filter((s) => new Date(s.timestamp) >= weekStart)
      .reduce(
        (sum, s) => sum + Math.min(MAX_SESSION_DURATION_SECONDS, Math.max(0, Number(s.metadata?.durationSeconds || 0))),
        0
      );
    const studyHoursThisWeek = Math.round((weekDurationSeconds / 3600) * 10) / 10;

    // 5. Weekly Activity Chart (Monday - Sunday of the current week)
    const weeklyActivity = this.computeWeeklyActivity(now, questionEvents, quizEvents);

    // 6. Topics Practiced & Topic Mastery from actual Quiz/Practice assessments
    const topicMasteryList = await this.computeTopicMastery(quizEvents, activeDocMap);

    // 7. Recommended Focus (derived from lowest mastery or most recent mistakes in active docs)
    const recommendedFocus = this.deriveRecommendedFocus(topicMasteryList, docs);

    return {
      questionsAsked,
      questionsToday,
      documents,
      indexedDocuments,
      quizzesCompleted,
      averageScore,
      studyHours,
      studyHoursThisWeek,
      weeklyActivity,
      topics: topicMasteryList,
      recommendedFocus,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Monday - Sunday calendar points for the current week
   */
  private computeWeeklyActivity(
    now: Date,
    questionEvents: LearningEvent[],
    quizEvents: LearningEvent[]
  ): WeeklyActivityPoint[] {
    const daysName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Find Monday of current week
    const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const weekPoints: WeeklyActivityPoint[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = this.toDateString(dayDate);
      const dayName = daysName[dayDate.getDay()];

      const questionsCount = questionEvents.filter(
        (e) => this.toDateString(new Date(e.timestamp)) === dateStr
      ).length;

      const quizzesCount = quizEvents.filter(
        (e) => this.toDateString(new Date(e.timestamp)) === dateStr
      ).length;

      weekPoints.push({
        day: dayName,
        date: dateStr,
        questions: questionsCount,
        quizzes: quizzesCount,
      });
    }

    return weekPoints;
  }

  /**
   * Derives topic mastery strictly from actual Practice/Quiz assessment performance.
   * Excludes deleted documents from active topic lists while preserving historical events.
   */
  private async computeTopicMastery(
    quizEvents: LearningEvent[],
    activeDocMap: Map<string, any>
  ): Promise<TopicMastery[]> {
    if (quizEvents.length === 0) {
      return [];
    }

    // Aggregate assessment results by topic key: `${documentId || 'all'}::${topicName}`
    const topicStats: {
      [key: string]: {
        topic: string;
        documentId?: string;
        category: string;
        totalQuestions: number;
        correctAnswers: number;
        quizzesTaken: number;
        lastPracticedAt: string;
      };
    } = {};

    for (const q of quizEvents) {
      const docId = q.documentId;
      // If the document was deleted, exclude from current active topic views
      if (docId && !activeDocMap.has(docId)) {
        continue;
      }

      const docName = docId && activeDocMap.has(docId) ? activeDocMap.get(docId).name : 'Course Material';
      const breakdown = q.metadata?.topicBreakdown;

      if (breakdown && typeof breakdown === 'object') {
        for (const [subTopic, counts] of Object.entries(breakdown)) {
          const key = `${docId || 'general'}::${subTopic.toLowerCase().trim()}`;
          if (!topicStats[key]) {
            topicStats[key] = {
              topic: subTopic,
              documentId: docId,
              category: docName,
              totalQuestions: 0,
              correctAnswers: 0,
              quizzesTaken: 0,
              lastPracticedAt: q.timestamp,
            };
          }
          topicStats[key].totalQuestions += (counts as any).total || 0;
          topicStats[key].correctAnswers += (counts as any).correct || 0;
          topicStats[key].quizzesTaken += 1;
          if (new Date(q.timestamp) > new Date(topicStats[key].lastPracticedAt)) {
            topicStats[key].lastPracticedAt = q.timestamp;
          }
        }
      } else {
        const top = q.topic || 'General Practice';
        const key = `${docId || 'general'}::${top.toLowerCase().trim()}`;
        if (!topicStats[key]) {
          topicStats[key] = {
            topic: top,
            documentId: docId,
            category: docName,
            totalQuestions: 0,
            correctAnswers: 0,
            quizzesTaken: 0,
            lastPracticedAt: q.timestamp,
          };
        }
        topicStats[key].totalQuestions += Number(q.metadata?.totalQuestions || 5);
        topicStats[key].correctAnswers += Number(q.metadata?.score || 0);
        topicStats[key].quizzesTaken += 1;
        if (new Date(q.timestamp) > new Date(topicStats[key].lastPracticedAt)) {
          topicStats[key].lastPracticedAt = q.timestamp;
        }
      }
    }

    const result: TopicMastery[] = [];
    for (const stat of Object.values(topicStats)) {
      if (stat.totalQuestions === 0) continue;
      const masteryPercentage = Math.round((stat.correctAnswers / stat.totalQuestions) * 100);
      result.push({
        topic: stat.topic,
        category: stat.category,
        masteryPercentage,
        quizzesTaken: stat.quizzesTaken,
        status: getMasteryStatus(masteryPercentage),
        documentId: stat.documentId,
        documentName: stat.category,
        attempts: stat.totalQuestions,
        correctAnswers: stat.correctAnswers,
        lastPracticedAt: stat.lastPracticedAt,
      });
    }

    // Sort by lowest mastery first, then most recently practiced
    result.sort((a, b) => {
      if (a.masteryPercentage !== b.masteryPercentage) {
        return a.masteryPercentage - b.masteryPercentage;
      }
      return new Date(b.lastPracticedAt || 0).getTime() - new Date(a.lastPracticedAt || 0).getTime();
    });

    return result;
  }

  /**
   * Recommends focus dynamically from actual student weaknesses or active document topics.
   */
  private deriveRecommendedFocus(topics: TopicMastery[], activeDocs: any[]): RecommendedFocus {
    if (topics.length === 0) {
      const firstDoc = activeDocs[0];
      return {
        documentId: firstDoc?.id,
        documentName: firstDoc?.name,
        topic: firstDoc?.name ? `${firstDoc.name.replace(/\.[^/.]+$/, '')} Concepts` : 'Course Material',
        reason: 'Complete your first practice quiz to generate personalized learning recommendations.',
      };
    }

    // 1. Prioritize topics with 'Needs Review' (< 60% mastery)
    const needsReview = topics.find((t) => t.status === 'Needs Review');
    if (needsReview) {
      return {
        conceptId: needsReview.conceptId,
        documentId: needsReview.documentId,
        documentName: needsReview.documentName,
        topic: needsReview.topic,
        reason: `Your recent quiz accuracy on "${needsReview.topic}" is ${needsReview.masteryPercentage}%. Review the related section before your next assessment.`,
      };
    }

    // 2. Next prioritize 'In Progress' (60% - 84%)
    const inProgress = topics.find((t) => t.status === 'In Progress');
    if (inProgress) {
      return {
        conceptId: inProgress.conceptId,
        documentId: inProgress.documentId,
        documentName: inProgress.documentName,
        topic: inProgress.topic,
        reason: `You're currently at ${inProgress.masteryPercentage}% mastery on "${inProgress.topic}". Practice another set of questions to achieve full mastery.`,
      };
    }

    // 3. If all are Mastered (>= 85%), congratulate and recommend reinforcing the one with the lowest score
    const lowest = topics[0];
    return {
      conceptId: lowest?.conceptId,
      documentId: lowest?.documentId,
      documentName: lowest?.documentName,
      topic: lowest?.topic || 'Course Concepts',
      reason: `Solid mastery demonstrated across all practiced topics. Keep skills sharp with a quick refresher on "${lowest?.topic}".`,
    };
  }

  private toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * For testing & audits: exposes in-memory copy of recorded events
   */
  getEvents(): LearningEvent[] {
    return [...this.events];
  }

  /**
   * For testing: resets storage cleanly
   */
  async clearAllEvents(): Promise<void> {
    this.events = [];
    this.eventIds.clear();
    await this.persistEvents();
  }
}

export const analyticsService = new AnalyticsService();
