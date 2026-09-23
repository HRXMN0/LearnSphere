import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config, getHealthStatus } from './config';
import { ragPipeline } from './services/ragPipeline';
import { azureOpenAI } from './services/azureOpenAIService';
import { azureSearch } from './services/azureSearchService';
import { azureSpeech } from './services/speechService';
import { visualService, VisualType } from './services/visualService';
import { studySessionService } from './services/studySessionService';
import { aiClassService } from './services/aiClassService';
import { pdfExportService } from './services/pdfExportService';
import { analyticsService } from './services/analyticsService';

const storageDir = path.join(process.cwd(), 'server', 'storage', 'documents');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Multer in-memory storage for audio recording uploads
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max audio
});

// Multer in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 45 * 1024 * 1024 }, // 45MB max
  fileFilter: (req, file, cb) => {
    const allowedMime = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/webp',
    ];
    if (allowedMime.includes(file.mimetype) || file.originalname.match(/\.(pdf|txt|md|png|jpg|jpeg|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload a PDF, text, markdown, or image file.'));
    }
  },
});

// ==========================================
// 1. Health Check Endpoint
// ==========================================
app.get('/api/health', async (req, res) => {
  const baseHealth = getHealthStatus();

  // If credentials are configured, verify live reachability of Azure Search index
  let searchReachable = false;
  if (config.search.isConfigured) {
    try {
      const connTest = await azureSearch.testConnection();
      searchReachable = connTest.reachable;
    } catch {
      searchReachable = false;
    }
  }

  res.json({
    status: baseHealth.status,
    azureOpenAI: config.openAI.isConfigured,
    azureSearch: config.search.isConfigured,
    azureSpeech: config.speech.isConfigured,
    searchReachable,
    index: config.search.indexName,
    deployments: {
      chat: config.openAI.chatDeployment,
      embedding: config.openAI.embeddingDeployment,
      speechRegion: config.speech.region,
    },
    missing: baseHealth.missing,
    message: baseHealth.message,
  });
});

app.get('/api/speech/config', (req, res) => {
  res.json({
    isConfigured: config.speech.isConfigured,
    region: config.speech.region,
  });
});

// ==========================================
// 2. Real Document Upload & Ingestion
// ==========================================
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in request.' });
    }

    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      return res.status(503).json({
        error: 'Azure AI services are not configured in server/.env.',
        message: 'Add AZURE_OPENAI_API_KEY and AZURE_SEARCH_API_KEY in server/.env to enable live document ingestion.',
        missing: getHealthStatus().missing,
      });
    }

    const { originalname, size, buffer, mimetype } = req.file;
    const sizeStr = `${(size / (1024 * 1024)).toFixed(2)} MB`;

    console.log(`[Upload] Processing document: "${originalname}" (${sizeStr})`);

    const storedDoc = await ragPipeline.ingestDocument(buffer, originalname, sizeStr, mimetype);

    if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
      try {
        fs.writeFileSync(path.join(storageDir, `${storedDoc.id}.pdf`), buffer);
      } catch (err) {
        console.warn('[Storage Warning] Could not persist original PDF buffer:', err);
      }
    }

    // Record document_indexed analytics event (fire-and-forget)
    analyticsService.recordEvent({
      id: `evt_doc_${storedDoc.id}`,
      type: 'document_indexed',
      timestamp: new Date().toISOString(),
      documentId: storedDoc.id,
      metadata: { documentName: originalname, size: sizeStr, chunksCount: storedDoc.chunksCount },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      document: storedDoc,
      message: `Document "${originalname}" successfully parsed and indexed into Azure AI Search index "${config.search.indexName}".`,
    });
  } catch (error: any) {
    console.error('[Upload Error]', error);
    res.status(500).json({
      error: 'Document processing and indexing failed',
      details: error.message,
    });
  }
});

// ==========================================
// 3. Document Library & Deletion
// ==========================================
app.get('/api/documents', async (req, res) => {
  const docs = await ragPipeline.getDocuments();
  res.json({ documents: docs });
});

app.get('/api/documents/:documentId/topic-map', async (req, res) => {
  try {
    const { documentId } = req.params;
    const topicMap = await ragPipeline.getCourseTopicMap(documentId);
    if (!topicMap) {
      return res.status(404).json({ error: `Topic map for document ${documentId} could not be generated.` });
    }
    res.json({ topicMap, status: 'ready' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve topic map', details: error.message });
  }
});

app.get('/api/documents/:documentId/topics', async (req, res) => {
  try {
    const { documentId } = req.params;
    const profile = await ragPipeline.getDocumentProfile(documentId);
    if (!profile) {
      return res.status(404).json({ error: `Document ${documentId} not found or profile could not be generated.` });
    }
    res.json({
      documentId,
      documentName: profile.documentName,
      title: profile.title,
      subject: profile.subject,
      mainTopic: profile.mainTopic,
      topics: profile.topics,
      keyConcepts: profile.keyConcepts,
      suggestedQuestions: profile.suggestedQuestions,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve topics', details: error.message });
  }
});

app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const deleted = await ragPipeline.deleteDocument(documentId);

    if (deleted) {
      res.json({ success: true, message: `Document ${documentId} and its chunks deleted from Azure AI Search.` });
    } else {
      res.status(404).json({ error: `Document ${documentId} not found.` });
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete document', details: error.message });
  }
});

// ==========================================
// 4. Real Grounded RAG Chat
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    // Support both { message, documentIds } and { question, activeDocumentIds }
    const question = req.body.message || req.body.question;
    const documentIds = req.body.documentIds || req.body.activeDocumentIds;
    const chunkIds = req.body.chunkIds || req.body.conceptContext?.chunkIds;
    const conceptContext = req.body.conceptContext;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question / message parameter cannot be empty.' });
    }

    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      return res.status(503).json({
        error: 'Azure AI services are not configured in server/.env.',
        message: 'Add AZURE_OPENAI_API_KEY and AZURE_SEARCH_API_KEY to enable live grounded RAG.',
        missing: getHealthStatus().missing,
      });
    }

    console.log(`[RAG Chat] Question: "${question}"`);
    if (conceptContext?.conceptTitle) {
      console.log(`[RAG Chat] Active Concept Context: "${conceptContext.conceptTitle}" (${chunkIds?.length || 0} chunks)`);
    }
    const result = await ragPipeline.answerQuestion(question, documentIds, chunkIds, conceptContext);

    // Record question_submitted analytics event (fire-and-forget)
    const questionEventId = `evt_q_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    analyticsService.recordEvent({
      id: questionEventId,
      type: 'question_submitted',
      timestamp: new Date().toISOString(),
      documentId: Array.isArray(documentIds) ? documentIds[0] : undefined,
      topic: conceptContext?.conceptTitle || conceptContext?.sectionTitle || undefined,
      metadata: { question: question.substring(0, 200) },
    }).catch(() => {});

    res.json(result);
  } catch (error: any) {
    console.error('[Chat Error]', error);
    res.status(500).json({
      error: 'Failed to generate grounded answer from Azure AI Search',
      details: error.message,
    });
  }
});

// ==========================================
// 5. Real Multimodal Vision Analysis
// ==========================================
app.post('/api/vision/analyze', upload.single('image'), async (req, res) => {
  try {
    let imageBase64: string;
    let mimeType: string;
    const userPrompt = req.body.prompt || 'Analyze this technical diagram or image in detail.';
    const originalName = req.file?.originalname || req.body.fileName || 'Uploaded Image';
    const sizeBytes = req.file ? req.file.size : (req.body.imageBase64 ? Math.round(req.body.imageBase64.length * 0.75) : 0);
    const fileSizeStr = sizeBytes > 1024 * 1024 ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(sizeBytes / 1024)} KB`;

    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      mimeType = req.body.mimeType || 'image/png';
    } else {
      return res.status(400).json({ error: 'No image file or imageBase64 provided.' });
    }

    if (!config.openAI.isConfigured) {
      return res.status(503).json({
        error: 'Azure OpenAI Vision is not configured in server/.env.',
        message: 'Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY to enable live multimodal analysis.',
      });
    }

    const requestId = `req-v-${Date.now()}`;
    console.log(`[Vision] Starting analysis [${requestId}]: file="${originalName}", mime="${mimeType}", size="${fileSizeStr}", deployment="${config.openAI.visionDeployment}"`);
    const analysis = await azureOpenAI.analyzeVisionImage(imageBase64, mimeType, userPrompt);
    console.log(`[Vision] Analysis success [${requestId}]: title="${analysis.title}", concepts=${analysis.keyConcepts.length}, steps=${analysis.stepByStep.length}, labels=${analysis.importantLabels.length}`);

    res.json({
      success: true,
      requestId,
      imageId: `img-${Date.now()}`,
      fileName: originalName,
      fileSize: fileSizeStr,
      mimeType,
      ...analysis,
      analysis,
    });
  } catch (error: any) {
    console.error('[Vision Error]', error);
    res.status(500).json({
      error: 'Vision analysis failed',
      details: error.message,
    });
  }
});

// Real Multimodal Vision Q&A grounded in the image
app.post('/api/vision/ask', upload.single('image'), async (req, res) => {
  try {
    let imageBase64: string;
    let mimeType: string;
    const question = req.body.question;
    const context = req.body.context;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
      mimeType = req.file.mimetype;
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      mimeType = req.body.mimeType || 'image/png';
    } else {
      return res.status(400).json({ error: 'Image is required to ask about this visual.' });
    }

    if (!config.openAI.isConfigured) {
      return res.status(503).json({
        error: 'Azure OpenAI is not configured in server/.env.',
      });
    }

    console.log(`[Vision Q&A] Asking about image: question="${question.slice(0, 80)}...", deployment="${config.openAI.visionDeployment}"`);
    const result = await azureOpenAI.askQuestionAboutImage(imageBase64, mimeType, question, context);
    console.log(`[Vision Q&A] Answer received (${result.answer.length} chars)`);

    res.json({
      success: true,
      question,
      answer: result.answer,
    });
  } catch (error: any) {
    console.error('[Vision Q&A Error]', error);
    res.status(500).json({
      error: 'Failed to answer question about image',
      details: error.message,
    });
  }
});

// Real Azure AI Search indexing for Vision analysis
app.post('/api/vision/index', async (req, res) => {
  try {
    const { analysis, imageName } = req.body;

    if (!analysis || !analysis.title || !analysis.whatISee) {
      return res.status(400).json({ error: 'Valid vision analysis object is required for indexing.' });
    }

    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      return res.status(503).json({
        error: 'Azure AI Search or Azure OpenAI is not configured in server/.env.',
        message: 'Credentials required to index visual knowledge into learning-chunks.',
      });
    }

    console.log(`[Vision RAG Ingest] Indexing visual analysis for "${analysis.title}" (${imageName || 'image'})...`);
    const doc = await ragPipeline.ingestVisionAnalysis(analysis, imageName || analysis.title);
    res.json({
      success: true,
      document: doc,
      message: `Successfully indexed "${doc.name}" into Azure AI Search index "${config.search.indexName}".`,
    });
  } catch (error: any) {
    console.error('[Vision RAG Ingest Error]', error);
    res.status(500).json({
      error: 'Failed to index vision analysis into Azure AI Search',
      details: error.message,
    });
  }
});

// ==========================================
// 6. Dynamic Quiz Generation
// ==========================================
const handleQuizGeneration = async (req: express.Request, res: express.Response) => {
  try {
    const documentIds = req.body.documentIds || req.body.activeDocumentIds;
    const topic = req.body.topic || 'Core Concepts';
    const count = parseInt(req.body.questionCount || req.body.count || '5', 10);
    const difficulty = req.body.difficulty || 'Medium';

    if (!config.openAI.isConfigured || !config.search.isConfigured) {
      return res.status(503).json({
        error: 'Azure AI services are not configured in server/.env.',
        message: 'Add Azure credentials to server/.env to enable dynamic quiz generation.',
      });
    }

    const chunkIds = req.body.chunkIds || (req.body.concept?.chunkIds);
    console.log(`[Quiz] Generating ${count} ${difficulty} questions for topic "${topic}" from active documents (specific chunks: ${chunkIds?.length || 0})`);
    const questions = await ragPipeline.generateDocumentQuiz(documentIds, topic, count, difficulty, chunkIds);

    res.json({ questions });
  } catch (error: any) {
    console.error('[Quiz Error]', error);
    res.status(500).json({
      error: 'Failed to generate quiz from document content',
      details: error.message,
    });
  }
};

app.post('/api/quiz', handleQuizGeneration);
app.post('/api/quiz/generate', handleQuizGeneration);

// ==========================================
// 7. Real Azure Speech-to-Text
// ==========================================
app.post('/api/speech/transcribe', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!config.speech.isConfigured) {
      return res.status(503).json({
        error: 'Azure Speech Service is not configured.',
        message: 'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env to enable speech-to-text.',
      });
    }

    let audioBuffer: Buffer;
    let mimeType = req.file?.mimetype || req.body?.mimeType || 'audio/webm; codecs=opus';

    if (req.file) {
      audioBuffer = req.file.buffer;
    } else if (req.body?.audioBase64) {
      const base64Data = req.body.audioBase64.replace(/^data:audio\/\w+;base64,/, '');
      audioBuffer = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(400).json({ error: 'No audio data received for transcription.' });
    }

    const result = await azureSpeech.transcribeAudio(audioBuffer, mimeType);
    res.json({
      success: true,
      transcript: result.text,
      duration: result.duration,
    });
  } catch (error: any) {
    console.error('[Speech Transcribe Error]', error);
    res.status(500).json({
      error: 'Speech transcription failed',
      details: error.message,
    });
  }
});

// ==========================================
// 8. Real Azure Speech Text-to-Speech
// ==========================================
app.post('/api/speech/synthesize', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    if (!config.speech.isConfigured) {
      return res.status(503).json({
        error: 'Azure Speech Service is not configured.',
        message: 'Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env to enable text-to-speech.',
      });
    }

    const result = await azureSpeech.synthesizeSpeech(text);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.audioBuffer.length);
    res.send(result.audioBuffer);
  } catch (error: any) {
    console.error('[Speech Synthesize Error]', error);
    res.status(500).json({
      error: 'Speech synthesis failed',
      details: error.message,
    });
  }
});

// ==========================================
// 9. Grounded Visual Explanations (Diagram / Flowchart / Mind Map)
// ==========================================
app.post('/api/visual/recommend', async (req, res) => {
  try {
    const { question, answer, sources } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }

    const recommendation = await visualService.recommendVisualType(question, answer, sources || []);
    res.json({
      success: true,
      ...recommendation,
    });
  } catch (error: any) {
    console.error('[Visual Recommend Error]', error);
    res.status(500).json({
      error: 'Failed to generate visual recommendation',
      details: error.message,
    });
  }
});

app.post('/api/visual/generate', async (req, res) => {
  try {
    const { question, answer, visualType, sources } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question and answer are required.' });
    }

    const type: VisualType = ['flowchart', 'mindmap', 'diagram'].includes(visualType)
      ? visualType
      : 'flowchart';

    const result = await visualService.generateVisualSpec(question, answer, type, sources || []);
    res.json(result);
  } catch (error: any) {
    console.error('[Visual Generate Error]', error);
    res.status(500).json({
      error: 'Failed to generate visual explanation',
      details: error.message,
    });
  }
});

app.post('/api/visual/generate-image', async (req, res) => {
  const imageDeployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT;
  if (!imageDeployment) {
    return res.status(501).json({
      error: 'Image generation deployment not configured.',
      message: 'Structured visual specifications (Flowchart, Mind Map, Diagram) are fully enabled and recommended.',
    });
  }
  res.status(501).json({ error: 'Custom image generation is not configured on this endpoint.' });
});

// ==========================================
// 8. Study Conversation APIs (Self-Paced Mode)
// ==========================================
app.post('/api/study-sessions', async (req, res) => {
  try {
    const { documentId } = req.body;
    const session = await studySessionService.createSession(documentId);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create study session', details: err.message });
  }
});

app.get('/api/study-sessions/:id', (req, res) => {
  const session = studySessionService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Study session not found' });
  res.json(session);
});

app.post('/api/study-sessions/:id/turn', async (req, res) => {
  try {
    const { text, generateAudio } = req.body;
    if (!text) return res.status(400).json({ error: 'User message text is required' });
    const result = await studySessionService.addTurn(req.params.id, text, generateAudio !== false);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process turn', details: err.message });
  }
});

app.post('/api/study-sessions/:id/end', async (req, res) => {
  try {
    const session = await studySessionService.endSession(req.params.id);

    // Record study_session_ended analytics event (fire-and-forget)
    if (session.durationSeconds && session.durationSeconds > 0) {
      analyticsService.recordEvent({
        id: `evt_study_${session.sessionId}`,
        type: 'study_session_ended',
        timestamp: new Date().toISOString(),
        documentId: session.documentId,
        metadata: {
          sessionId: session.sessionId,
          durationSeconds: session.durationSeconds,
          documentName: session.documentName,
          turnsCount: session.turns?.length || 0,
        },
      }).catch(() => {});
    }

    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to end study session', details: err.message });
  }
});

app.get('/api/study-sessions/:id/transcript', (req, res) => {
  const session = studySessionService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Study session not found' });
  res.json({ turns: session.turns });
});

app.get('/api/study-sessions/:id/export/txt', (req, res) => {
  try {
    const txt = studySessionService.exportTxt(req.params.id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="study-transcript-${req.params.id}.txt"`);
    res.send(txt);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export txt', details: err.message });
  }
});

app.get('/api/study-sessions/:id/export/json', (req, res) => {
  const session = studySessionService.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Study session not found' });
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="study-session-${req.params.id}.json"`);
  res.json(session);
});

app.get('/api/study-sessions/:id/export/pdf', async (req, res) => {
  try {
    const pdfBuf = await studySessionService.exportPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="study-transcript-${req.params.id}.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export pdf', details: err.message });
  }
});

app.post('/api/study-sessions/:id/append-transcript', upload.single('file'), async (req, res) => {
  try {
    const session = studySessionService.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Study session not found' });

    let originalBuffer: Buffer | null = req.file?.buffer || null;
    if (!originalBuffer) {
      const storedPath = path.join(storageDir, `${session.documentId}.pdf`);
      if (fs.existsSync(storedPath)) {
        originalBuffer = fs.readFileSync(storedPath);
      }
    }

    const exportNotes = session.turns
      .filter((t) => t.speaker === 'assistant')
      .map((t) => ({
        section: t.structuredAnswer?.title || 'Study Discussion',
        content: t.text,
        timestamp: t.timestamp,
        sources: t.sources?.map((s) => ({ documentName: s.documentName, pageNumber: s.pageNumber })),
      }));

    if (originalBuffer) {
      const mergedPdf = await pdfExportService.appendNotesToExistingPdf(
        originalBuffer,
        session.documentName,
        exportNotes,
        session.summary?.summaryText
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${session.documentName.replace('.pdf', '')}_with_study_notes.pdf"`);
      return res.send(mergedPdf);
    } else {
      const standAlonePdf = await pdfExportService.generateNotesPdf(
        `AI STUDY NOTES: ${session.documentName}`,
        session.documentName,
        exportNotes,
        session.summary?.summaryText
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${session.documentName.replace('.pdf', '')}_study_notes.pdf"`);
      return res.send(standAlonePdf);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to append transcript', details: err.message });
  }
});

// ==========================================
// 9. AI Live Class APIs (Teacher Mode)
// ==========================================
app.post('/api/ai-classes', async (req, res) => {
  try {
    const { documentId } = req.body;
    const session = await aiClassService.createClass(documentId);
    res.status(201).json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create AI class', details: err.message });
  }
});

app.get('/api/ai-classes/:id', (req, res) => {
  const session = aiClassService.getClass(req.params.id);
  if (!session) return res.status(404).json({ error: 'Class not found' });
  res.json(session);
});

app.post('/api/ai-classes/:id/start', async (req, res) => {
  try {
    const result = await aiClassService.startClass(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start class', details: err.message });
  }
});

app.post('/api/ai-classes/:id/step', async (req, res) => {
  try {
    const stepIndex = req.body?.stepIndex !== undefined ? Number(req.body.stepIndex) : undefined;
    const result = await aiClassService.executeStep(req.params.id, stepIndex);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to execute step', details: err.message });
  }
});

app.post('/api/ai-classes/:id/prefetch', async (req, res) => {
  try {
    const stepIndex = req.body?.stepIndex !== undefined ? Number(req.body.stepIndex) : undefined;
    const result = await aiClassService.prefetchNextStep(req.params.id, stepIndex);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to prefetch next step', details: err.message });
  }
});

app.post(['/api/ai-classes/:id/next-step', '/api/ai-classes/:id/nextStep', '/api/ai-classes/:id/turn'], async (req, res) => {
  try {
    const result = await aiClassService.nextStep(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to advance class step', details: err.message });
  }
});

app.post('/api/ai-classes/:id/interrupt', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required for interruption' });
    const result = await aiClassService.interrupt(req.params.id, question);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process interruption', details: err.message });
  }
});

app.post('/api/ai-classes/:id/answer-check', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'Answer is required' });
    const result = await aiClassService.answerCheck(req.params.id, answer);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to evaluate check', details: err.message });
  }
});

app.post('/api/ai-classes/:id/pause', async (req, res) => {
  try {
    const session = await aiClassService.pauseClass(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to pause class', details: err.message });
  }
});

app.post('/api/ai-classes/:id/resume', async (req, res) => {
  try {
    const session = await aiClassService.resumeClass(req.params.id);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resume class', details: err.message });
  }
});

app.post('/api/ai-classes/:id/end', async (req, res) => {
  try {
    const session = await aiClassService.endClass(req.params.id);

    // Record live_class_ended analytics event (fire-and-forget)
    if (session.durationSeconds && session.durationSeconds > 0) {
      analyticsService.recordEvent({
        id: `evt_class_${session.classId || req.params.id}`,
        type: 'live_class_ended',
        timestamp: new Date().toISOString(),
        documentId: session.documentId,
        metadata: {
          classId: session.classId || req.params.id,
          durationSeconds: session.durationSeconds,
          documentName: session.documentName,
          topicsCovered: session.topicsCovered,
        },
      }).catch(() => {});
    }

    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to end class', details: err.message });
  }
});

app.get('/api/ai-classes/:id/notes', (req, res) => {
  const session = aiClassService.getClass(req.params.id);
  if (!session) return res.status(404).json({ error: 'Class not found' });
  res.json({ notes: session.notes });
});

app.get('/api/ai-classes/:id/transcript', (req, res) => {
  const session = aiClassService.getClass(req.params.id);
  if (!session) return res.status(404).json({ error: 'Class not found' });
  res.json({ turns: session.turns });
});

app.get('/api/ai-classes/:id/export/notes-pdf', async (req, res) => {
  try {
    const pdfBuf = await aiClassService.exportNotesPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="class-notes-${req.params.id}.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export notes pdf', details: err.message });
  }
});

app.get('/api/ai-classes/:id/export/transcript-pdf', async (req, res) => {
  try {
    const pdfBuf = await aiClassService.exportTranscriptPdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="class-transcript-${req.params.id}.pdf"`);
    res.send(pdfBuf);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export transcript pdf', details: err.message });
  }
});

app.get('/api/ai-classes/:id/export/txt', (req, res) => {
  try {
    const txt = aiClassService.exportTxt(req.params.id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="class-notes-${req.params.id}.txt"`);
    res.send(txt);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export txt', details: err.message });
  }
});

app.post('/api/ai-classes/:id/append-notes', upload.single('file'), async (req, res) => {
  try {
    const session = aiClassService.getClass(req.params.id);
    if (!session) return res.status(404).json({ error: 'Class not found' });

    let originalBuffer: Buffer | null = req.file?.buffer || null;
    if (!originalBuffer) {
      const storedPath = path.join(storageDir, `${session.documentId}.pdf`);
      if (fs.existsSync(storedPath)) {
        originalBuffer = fs.readFileSync(storedPath);
      }
    }

    const exportNotes = session.notes.map((n) => ({
      section: n.section,
      content: n.content,
      timestamp: n.timestamp,
      keyPoints: n.keyPoints,
      sources: n.sources?.map((s) => ({ documentName: s.documentName, pageNumber: s.pageNumber })),
    }));

    if (originalBuffer) {
      const mergedPdf = await pdfExportService.appendNotesToExistingPdf(
        originalBuffer,
        session.documentName,
        exportNotes,
        session.summary?.summaryText
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${session.documentName.replace('.pdf', '')}_with_class_notes.pdf"`);
      return res.send(mergedPdf);
    } else {
      const standAlonePdf = await pdfExportService.generateNotesPdf(
        `AI CLASS NOTES: ${session.documentName}`,
        session.documentName,
        exportNotes,
        session.summary?.summaryText
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${session.documentName.replace('.pdf', '')}_class_notes.pdf"`);
      return res.send(standAlonePdf);
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to append notes', details: err.message });
  }
});

// ==========================================
// 10. Analytics & Insights API
// ==========================================
app.get('/api/insights', async (req, res) => {
  try {
    const insights = await analyticsService.getInsights();
    res.json(insights);
  } catch (error: any) {
    console.error('[Insights Error]', error);
    res.status(500).json({ error: 'Failed to compute insights', details: error.message });
  }
});

app.post('/api/quiz/evaluate', async (req, res) => {
  try {
    const { quizId, documentId, topic, userAnswers, questions } = req.body;

    if (!quizId || !userAnswers || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'quizId, userAnswers, and questions[] are required.' });
    }

    const submission = await analyticsService.evaluateAndRecordQuiz(
      quizId,
      documentId,
      topic || 'General Practice',
      userAnswers,
      questions
    );

    res.json(submission);
  } catch (error: any) {
    console.error('[Quiz Evaluate Error]', error);
    res.status(500).json({ error: 'Failed to evaluate quiz', details: error.message });
  }
});

app.get('/api/analytics/events', (req, res) => {
  res.json({ events: analyticsService.getEvents(), count: analyticsService.getEvents().length });
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================================`);
  console.log(`[Server] Multimodal Learning Assistant API running on port ${PORT}`);
  console.log(`[Server] Azure OpenAI Chat Deployment: ${config.openAI.chatDeployment}`);
  console.log(`[Server] Azure OpenAI Embedding Deployment: ${config.openAI.embeddingDeployment}`);
  console.log(`[Server] Azure AI Search Index: ${config.search.indexName}`);
  console.log(`[Server] Azure Configured: ${config.openAI.isConfigured && config.search.isConfigured}`);
  console.log(`========================================================`);
});

server.on('error', (err) => {
  console.error('[Server Error]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

// Explicit event-loop keepalive
setInterval(() => {}, 1000 * 60 * 60);
