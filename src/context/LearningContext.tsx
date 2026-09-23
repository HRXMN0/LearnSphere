import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { LearningDocument, DocumentUploadSimulationStep, ActiveConceptContext } from '../types/document';
import { ChatMessage, SourceCitation, StructuredAnswer } from '../types/chat';
import { VisionAnalysis } from '../types/vision';
import { StudyOverviewMetrics, InsightsData } from '../types/analytics';
import { DEMO_DOCUMENTS, DEMO_PRESET_CONVERSATION, DEMO_VISION_ANALYSIS, DEMO_STUDY_METRICS } from '../data/demoData';
import { aiService } from '../services/aiService';
import { documentService } from '../services/documentService';
import { visionService } from '../services/visionService';
import { frontendAnalyticsService } from '../services/analyticsService';
import { useApp } from './AppContext';

interface LearningContextType {
  documents: LearningDocument[];
  activeDocumentIds: string[];
  toggleDocumentActive: (id: string) => void;
  chatMessages: ChatMessage[];
  isAIThinking: boolean;
  aiThinkingStep: string;
  activeSourceForInspection: SourceCitation | null;
  activeQueryForInspection: string;
  inspectSource: (source: SourceCitation, query?: string) => void;
  closeSourceInspection: () => void;
  currentTopic: string;
  setCurrentTopic: (topic: string) => void;
  relatedConcepts: string[];
  setRelatedConcepts: (concepts: string[]) => void;
  suggestedQuestions: string[];
  setSuggestedQuestions: (questions: string[]) => void;
  activeConceptContext: ActiveConceptContext | null;
  setActiveConceptContext: (ctx: ActiveConceptContext | null) => void;
  clearActiveConceptContext: () => void;
  askQuestion: (query: string, overrideConceptContext?: ActiveConceptContext | null) => Promise<void>;
  generateTopicSummary: () => Promise<void>;
  generateExamQuestionsPrompt: () => Promise<void>;
  visionAnalysis: VisionAnalysis | null;
  visionState: 'EMPTY' | 'IMAGE_SELECTED' | 'ANALYZING' | 'ANALYZED' | 'ERROR';
  visionError: string | null;
  currentVisionImage: { name: string; size?: string; previewUrl?: string; fileObj?: File } | null;
  isVisionAnalyzing: boolean;
  isVisionIndexing: boolean;
  isVisionIndexed: boolean;
  analyzeVisionImage: (imageFile: { name: string; url?: string; fileObj?: File }) => Promise<void>;
  askVisionQuestion: (question: string) => Promise<string>;
  addVisionToKnowledgeBase: () => Promise<void>;
  loadVisionDemo: () => Promise<void>;
  clearVision: () => void;
  uploadDocumentModalOpen: boolean;
  setUploadDocumentModalOpen: (open: boolean) => void;
  uploadProgressStep: DocumentUploadSimulationStep | null;
  uploadDocument: (file: File | { name: string; size: string; type: string; fileObj?: File }) => Promise<LearningDocument>;
  deleteDocument: (id: string) => Promise<void>;
  studyMetrics: StudyOverviewMetrics;
  insightsData: InsightsData | null;
  refreshInsights: () => Promise<void>;
  resetDemoState: () => void;
  loadDemoContent: () => void;
  isDemoMode: boolean;
}

const LearningContext = createContext<LearningContextType | undefined>(undefined);

export const LearningProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { addToast, isDemoMode } = useApp();

  const [documents, setDocuments] = useState<LearningDocument[]>(() => isDemoMode ? DEMO_DOCUMENTS : []);
  const [activeDocumentIds, setActiveDocumentIds] = useState<string[]>(() => isDemoMode ? DEMO_DOCUMENTS.map(d => d.id) : []);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => isDemoMode ? DEMO_PRESET_CONVERSATION : []);
  const [isAIThinking, setIsAIThinking] = useState<boolean>(false);
  const [aiThinkingStep, setAiThinkingStep] = useState<string>('');
  
  const [activeSourceForInspection, setActiveSourceForInspection] = useState<SourceCitation | null>(null);
  const [activeQueryForInspection, setActiveQueryForInspection] = useState<string>('');

  const [currentTopic, setCurrentTopic] = useState<string>('Analyzing material...');
  const [relatedConcepts, setRelatedConcepts] = useState<string[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [activeConceptContext, setActiveConceptContext] = useState<ActiveConceptContext | null>(null);
  const clearActiveConceptContext = () => setActiveConceptContext(null);

  const [visionAnalysis, setVisionAnalysis] = useState<VisionAnalysis | null>(null);
  const [visionState, setVisionState] = useState<'EMPTY' | 'IMAGE_SELECTED' | 'ANALYZING' | 'ANALYZED' | 'ERROR'>('EMPTY');
  const [visionError, setVisionError] = useState<string | null>(null);
  const [currentVisionImage, setCurrentVisionImage] = useState<{ name: string; size?: string; previewUrl?: string; fileObj?: File } | null>(null);
  const [isVisionAnalyzing, setIsVisionAnalyzing] = useState<boolean>(false);
  const [isVisionIndexing, setIsVisionIndexing] = useState<boolean>(false);
  const [isVisionIndexed, setIsVisionIndexed] = useState<boolean>(false);
  const visionRequestIdRef = useRef<number>(0);

  const [uploadDocumentModalOpen, setUploadDocumentModalOpen] = useState<boolean>(false);
  const [uploadProgressStep, setUploadProgressStep] = useState<DocumentUploadSimulationStep | null>(null);

  const [studyMetrics, setStudyMetrics] = useState<StudyOverviewMetrics>(DEMO_STUDY_METRICS);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);

  // Refresh insights from backend (live mode only)
  const refreshInsights = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const data = await frontendAnalyticsService.getInsights();
      if (data) {
        setInsightsData(data);
        // Sync studyMetrics from real insights data
        setStudyMetrics({
          questionsAsked: data.questionsAsked,
          documentsIndexed: data.indexedDocuments,
          quizzesCompleted: data.quizzesCompleted,
          averageQuizScore: data.averageScore ?? 0,
          topicsMastered: data.topics.filter(t => t.status === 'Mastered').length,
          studyHoursThisWeek: data.studyHoursThisWeek,
        });
      }
    } catch (err) {
      console.warn('[LearningContext] refreshInsights error:', err);
    }
  }, [isDemoMode]);

  // Sync real uploaded documents from backend on initial mount
  useEffect(() => {
    if (!isDemoMode) {
      documentService.getDocuments().then((serverDocs) => {
        if (serverDocs && serverDocs.length > 0) {
          setDocuments(serverDocs);
          setActiveDocumentIds([serverDocs[0].id]);
        } else {
          setDocuments([]);
          setActiveDocumentIds([]);
        }
      });
      // Fetch real insights on mount
      refreshInsights();
    }
  }, [isDemoMode, refreshInsights]);

  // Synchronize document-aware topic, concepts, and suggestions whenever activeDocumentIds or documents change
  useEffect(() => {
    if (isDemoMode) {
      setCurrentTopic('Transport Layer');
      setRelatedConcepts(['TCP', 'UDP', 'Reliability', 'Flow Control', 'Congestion Control', 'Three-Way Handshake']);
      setSuggestedQuestions([
        'What is the difference between TCP and UDP?',
        'Explain the TCP three-way handshake',
        'Explain congestion control vs flow control',
        'Show the OSI 7-layer model'
      ]);
      return;
    }

    const activeDocs = documents.filter((d) => activeDocumentIds.includes(d.id));

    // Clear active concept if its document is no longer active
    if (activeConceptContext && !activeDocumentIds.includes(activeConceptContext.documentId)) {
      setActiveConceptContext(null);
    }

    if (activeDocs.length === 0) {
      setCurrentTopic('Upload learning material to begin');
      setRelatedConcepts([]);
      setSuggestedQuestions([
        'Upload your PDF to start learning',
        'Ask questions about your uploaded documents',
        'Generate custom quizzes grounded in your course'
      ]);
      return;
    }

    if (activeDocs.length === 1) {
      const doc = activeDocs[0];
      const profile = doc.profile;
      const topicName = profile?.mainTopic || doc.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[\.\s\-_]*/, '');
      setCurrentTopic(topicName);

      if (profile?.keyConcepts && profile.keyConcepts.length > 0) {
        setRelatedConcepts(profile.keyConcepts);
      } else {
        setRelatedConcepts([topicName]);
      }

      if (profile?.suggestedQuestions && profile.suggestedQuestions.length > 0) {
        setSuggestedQuestions(profile.suggestedQuestions);
      } else {
        setSuggestedQuestions([
          `What are the core concepts introduced in ${topicName}?`,
          `Explain the key principles of ${topicName}.`,
          `Summarize this document.`,
          `Quiz me on ${topicName}`
        ]);
      }
    } else {
      // Multiple active documents
      setCurrentTopic(`${activeDocs.length} Learning Materials Selected`);
      const combinedConcepts = Array.from(
        new Set(activeDocs.flatMap((d) => d.profile?.keyConcepts || [d.name.replace(/\.[^/.]+$/, '')]))
      ).slice(0, 10);
      setRelatedConcepts(combinedConcepts);

      const combinedQuestions = Array.from(
        new Set(activeDocs.flatMap((d) => d.profile?.suggestedQuestions || [`Explain ${d.name}`]))
      ).slice(0, 4);
      setSuggestedQuestions(combinedQuestions);
    }
  }, [activeDocumentIds, documents, isDemoMode]);

  const toggleDocumentActive = (id: string) => {
    setActiveDocumentIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const inspectSource = (source: SourceCitation, query?: string) => {
    setActiveSourceForInspection(source);
    if (query) {
      setActiveQueryForInspection(query);
    }
  };

  const closeSourceInspection = () => {
    setActiveSourceForInspection(null);
  };

  const askQuestion = async (query: string, overrideConceptContext?: ActiveConceptContext | null) => {
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setIsAIThinking(true);
    const conceptToUse = overrideConceptContext !== undefined ? overrideConceptContext : activeConceptContext;
    setAiThinkingStep(
      conceptToUse?.conceptTitle
        ? `Searching Azure AI Search chunks for concept "${conceptToUse.conceptTitle}"...`
        : 'Searching Azure AI Search index (learning-chunks)...'
    );

    try {
      const result = await aiService.generateRAGResponse(query, activeDocumentIds, isDemoMode, conceptToUse || undefined);

      const assistantMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        content: result.rawTextResponse || result.answer.shortAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        capabilities: (result.isGrounded && result.sources && result.sources.length > 0) ? ['RAG GROUNDED', 'GENERATIVE AI'] : ['GENERATIVE AI'],
        structuredAnswer: result.answer,
        sources: result.sources,
        debugInfo: result.debugInfo,
        suggestedFollowUps: result.followUps || (result.isGrounded ? [
          'Explain this simply',
          'Make a comparison table',
          'Quiz me on this'
        ] : [
          'Upload relevant study material',
          'Ask about concepts in your document'
        ])
      };

      setChatMessages(prev => [...prev, assistantMsg]);
      setStudyMetrics(prev => ({
        ...prev,
        questionsAsked: prev.questionsAsked + 1
      }));
      // Refresh real insights after each question (live mode)
      refreshInsights();
    } catch (err: any) {
      addToast(err.message || 'Error generating AI answer.', 'error');
    } finally {
      setIsAIThinking(false);
      setAiThinkingStep('');
    }
  };

  const generateTopicSummary = async () => {
    const prompt = `Summarize key concepts from ${currentTopic}`;
    await askQuestion(prompt);
  };

  const generateExamQuestionsPrompt = async () => {
    const prompt = `Generate exam questions for ${currentTopic}`;
    await askQuestion(prompt);
  };

  const analyzeVisionImage = async (imageFile: { name: string; url?: string; fileObj?: File }) => {
    const requestId = ++visionRequestIdRef.current;

    // Clean up previous blob URL to prevent memory leaks
    if (currentVisionImage?.previewUrl && currentVisionImage.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentVisionImage.previewUrl);
      } catch (e) {
        console.warn('Could not revoke previous object URL', e);
      }
    }

    const previewUrl = imageFile.fileObj ? URL.createObjectURL(imageFile.fileObj) : imageFile.url;
    const sizeStr = imageFile.fileObj ? `${(imageFile.fileObj.size / (1024 * 1024)).toFixed(2)} MB` : '1.5 MB';

    setCurrentVisionImage({
      name: imageFile.name,
      size: sizeStr,
      previewUrl,
      fileObj: imageFile.fileObj,
    });

    // 1. Immediately clear previous analysis and state
    setVisionAnalysis(null);
    setVisionError(null);
    setIsVisionIndexed(false);
    setVisionState('ANALYZING');
    setIsVisionAnalyzing(true);

    try {
      const analysis = await visionService.analyzeImage(imageFile);

      // Verify this response matches the current active request
      if (requestId === visionRequestIdRef.current) {
        setVisionAnalysis(analysis);
        setVisionState('ANALYZED');
        addToast(`Vision analysis complete for ${imageFile.name}`, 'success');
      }
    } catch (err: any) {
      if (requestId === visionRequestIdRef.current) {
        setVisionError(err.message || 'Vision analysis encountered an error.');
        setVisionState('ERROR');
        addToast(err.message || 'Vision analysis failed.', 'error');
      }
    } finally {
      if (requestId === visionRequestIdRef.current) {
        setIsVisionAnalyzing(false);
      }
    }
  };

  const askVisionQuestion = async (question: string): Promise<string> => {
    if (!currentVisionImage) {
      throw new Error('No image loaded to ask about. Please upload an image first.');
    }
    return await visionService.askQuestionAboutImage(
      { fileObj: currentVisionImage.fileObj },
      question,
      visionAnalysis?.whatISee
    );
  };

  const addVisionToKnowledgeBase = async () => {
    if (!visionAnalysis) return;

    setIsVisionIndexing(true);
    try {
      const result = await visionService.indexVisionAnalysis(
        visionAnalysis,
        currentVisionImage?.name || visionAnalysis.title
      );

      const realDoc: LearningDocument = {
        id: result.document.id,
        name: result.document.name,
        type: 'image',
        size: result.document.size || '1.2 MB',
        pages: 1,
        sectionsCount: visionAnalysis.stepByStep?.length || 1,
        diagramsCount: 1,
        tablesCount: 0,
        uploadedAt: 'Just now',
        status: 'ready',
        topicCategory: visionAnalysis.keyConcepts[0] || 'Visual Knowledge',
        description: visionAnalysis.whatISee,
      };

      setDocuments(prev => [realDoc, ...prev.filter(d => d.id !== realDoc.id)]);
      setActiveDocumentIds(prev => [realDoc.id, ...prev]);
      setIsVisionIndexed(true);
      setVisionAnalysis(prev => prev ? { ...prev, isIndexedInRAG: true } : null);
      addToast(`Indexed "${realDoc.name}" into Azure AI Search!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to add vision analysis to Knowledge Base.', 'error');
      throw err;
    } finally {
      setIsVisionIndexing(false);
    }
  };

  const loadVisionDemo = async () => {
    const requestId = ++visionRequestIdRef.current;
    if (currentVisionImage?.previewUrl && currentVisionImage.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentVisionImage.previewUrl);
    }

    setVisionError(null);
    setIsVisionIndexed(false);
    setVisionState('ANALYZED');
    setIsVisionAnalyzing(false);

    const demo = await visionService.getDemoAnalysis();
    setCurrentVisionImage({
      name: 'TCP Three-Way Handshake (Example Demo)',
      size: 'Protocol Architecture Example',
      previewUrl: 'demo-tcp-svg',
    });
    setVisionAnalysis(demo);
    addToast('Example TCP Handshake diagram loaded.', 'info');
  };

  const clearVision = () => {
    if (currentVisionImage?.previewUrl && currentVisionImage.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentVisionImage.previewUrl);
    }
    setCurrentVisionImage(null);
    setVisionAnalysis(null);
    setVisionError(null);
    setIsVisionIndexed(false);
    setVisionState('EMPTY');
  };

  const uploadDocument = async (fileInput: File | { name: string; size: string; type: string; fileObj?: File }): Promise<LearningDocument> => {
    try {
      const newDoc = await documentService.uploadDocument(fileInput, (step) => {
        setUploadProgressStep(step);
      });
      setDocuments(prev => {
        const hasOnlyDemo = prev.every(d => d.id.startsWith('doc-') && !d.id.startsWith('doc_'));
        return hasOnlyDemo ? [newDoc] : [newDoc, ...prev.filter(d => !d.id.startsWith('doc-'))];
      });
      setActiveDocumentIds([newDoc.id]);
      setStudyMetrics(prev => ({ ...prev, documentsIndexed: prev.documentsIndexed + 1 }));
      addToast(`${newDoc.name} successfully indexed for RAG!`, 'success');
      // Refresh real insights after document upload (live mode)
      refreshInsights();
      return newDoc;
    } catch (err: any) {
      addToast(err.message || 'Failed to process document.', 'error');
      throw err;
    }
  };

  const deleteDocument = async (id: string) => {
    await documentService.deleteDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    setActiveDocumentIds(prev => prev.filter(dId => dId !== id));
    addToast('Document removed from library.', 'info');
    // Refresh insights (document count changes, topic views update)
    refreshInsights();
  };

  const loadDemoContent = () => {
    setDocuments(DEMO_DOCUMENTS);
    setActiveDocumentIds(DEMO_DOCUMENTS.map(d => d.id));
    setChatMessages(DEMO_PRESET_CONVERSATION);
    setVisionAnalysis(DEMO_VISION_ANALYSIS);
    setStudyMetrics(DEMO_STUDY_METRICS);
    addToast('Demo Computer Networks materials loaded.', 'success');
  };

  const resetDemoState = () => {
    setDocuments(DEMO_DOCUMENTS);
    setActiveDocumentIds(DEMO_DOCUMENTS.map(d => d.id));
    setChatMessages(DEMO_PRESET_CONVERSATION);
    setVisionAnalysis(DEMO_VISION_ANALYSIS);
    setStudyMetrics(DEMO_STUDY_METRICS);
    setActiveSourceForInspection(null);
    addToast('Demo environment reset to initial state.', 'info');
  };

  return (
    <LearningContext.Provider
      value={{
        documents,
        activeDocumentIds,
        toggleDocumentActive,
        chatMessages,
        isAIThinking,
        aiThinkingStep,
        activeSourceForInspection,
        activeQueryForInspection,
        inspectSource,
        closeSourceInspection,
        currentTopic,
        setCurrentTopic,
        relatedConcepts,
        setRelatedConcepts,
        suggestedQuestions,
        setSuggestedQuestions,
        activeConceptContext,
        setActiveConceptContext,
        clearActiveConceptContext,
        askQuestion,
        generateTopicSummary,
        generateExamQuestionsPrompt,
        visionAnalysis,
        visionState,
        visionError,
        currentVisionImage,
        isVisionAnalyzing,
        isVisionIndexing,
        isVisionIndexed,
        analyzeVisionImage,
        askVisionQuestion,
        addVisionToKnowledgeBase,
        loadVisionDemo,
        clearVision,
        uploadDocumentModalOpen,
        setUploadDocumentModalOpen,
        uploadProgressStep,
        uploadDocument,
        deleteDocument,
        studyMetrics,
        insightsData,
        refreshInsights,
        resetDemoState,
        loadDemoContent,
        isDemoMode
      }}
    >
      {children}
    </LearningContext.Provider>
  );
};

export const useLearning = () => {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error('useLearning must be used within a LearningProvider');
  }
  return context;
};
