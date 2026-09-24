# LearnSphere

LearnSphere is a web-based learning assistant that helps students study directly from their own course material. Students upload PDFs or text documents, and the system uses Azure AI services to answer questions, run quizzes, teach live classes, and analyze diagrams — all grounded in the uploaded content.

Built as a capstone project for the **AI-103: Azure AI Engineer** course.

**Repository:** [github.com/HRXMN0/LearnSphere](https://github.com/HRXMN0/LearnSphere)

---

## What problem are we solving?

Students deal with dense course PDFs — lecture notes, textbook chapters, technical diagrams — and often need more than just reading them:

- They need **explanations** in simpler language, with examples and analogies.
- They need **practice questions** generated from the actual syllabus, not generic ones.
- They need **traceable answers** — knowing exactly which page a fact came from.
- Generic chatbots answer beyond the provided material and can invent facts. Students need answers **bounded to their course content**, with honest refusal when the material doesn't cover a topic.

---

## What does LearnSphere do?

### Ask

Students type a question about their selected course material. The backend retrieves relevant chunks from Azure AI Search, passes them as context to GPT-5.6 Sol, and returns a structured answer with page-level citations. If the selected documents don't contain enough evidence, the system tells the student rather than guessing.

### AI Live Class

A 1-to-1 interactive teaching experience:

1. Student selects a document (and optionally a specific unit, section, or concept from the Course Topic Map).
2. The AI teacher builds a lesson plan from the document's topic map (3–6 concepts per session).
3. The teacher proactively lectures through each concept — writing structured notes on a teaching board and speaking through the explanation.
4. The student can interrupt at any time to ask a question using voice or text.
5. Student speech is captured via the browser microphone, sent to **Azure Speech-to-Text** for transcription, and the question is answered using RAG retrieval from the selected material.
6. **GPT-5.6 Sol** generates the teaching response, and **Azure Speech (Text-to-Speech)** converts it to spoken audio.
7. The lesson stays scoped to the selected material — the AI teacher won't wander off-topic.
8. At the end, students can export class notes and transcripts as PDF or text.

### Practice & Quizzes

Students generate multiple-choice quizzes from their uploaded documents. They pick a topic, difficulty level, and number of questions. The backend retrieves relevant chunks and asks GPT-5.6 Sol to create questions grounded in that content.

Quiz results (score, weak topics, strong topics) are recorded by the analytics service and feed into the Learning Insights dashboard. Students can see which topics they need to revise.

### Vision

Students upload an image — a diagram, flowchart, circuit schematic, or handwritten notes — and the system analyzes it using Azure OpenAI's vision capabilities (multimodal input to GPT-5.6 Sol). The analysis returns:

- A descriptive title and visual summary
- Key concepts identified in the image
- Step-by-step breakdown (if the image depicts a sequential process)
- Important labels extracted from the image
- A detailed educational explanation

Students can also ask follow-up questions about the same image. Analyzed visuals can be indexed into Azure AI Search so they become part of the retrievable knowledge base.

### Course Topic Map

When a document is uploaded, the system builds a hierarchical topic map:

**Document → Unit → Section → Concept**

Each concept node is linked to specific chunk IDs and page ranges from the index. This map is shared across features:

- **Ask** can scope retrieval to a specific concept's chunks.
- **AI Live Class** uses the map to build its lesson plan.
- **Practice** can generate quizzes focused on a specific section or concept.

The topic map is cached on disk and in memory so it doesn't need to be regenerated on every request.

### Learning Insights

The backend tracks learning events (questions asked, documents indexed, quizzes completed, study sessions ended, live classes ended) in a persistent JSON file. The Insights dashboard computes:

- Total questions asked (and today's count)
- Documents indexed
- Quizzes completed and average score
- Study hours (from session and class durations, capped at 2 hours per session)
- Weekly activity chart
- Per-topic mastery derived from quiz performance
- Recommended focus areas based on lowest mastery scores

All analytics are computed server-side from real event data — no hardcoded numbers.

---

## How the RAG pipeline works

```
PDF upload
  → local text extraction (pdf-parse, page-by-page)
  → page-aware chunking (~600 tokens per chunk, ~90 token overlap)
  → embedding via text-embedding-3-small (1536 dimensions)
  → indexed into Azure AI Search (learning-chunks index)

Student asks a question
  → query embedded via text-embedding-3-small
  → hybrid search (vector + full-text) with documentId filter
  → top-K chunks retrieved
  → chunks passed as context to GPT-5.6 Sol
  → structured grounded response with page-level citations
```

**Key principle:** The course material determines *what* is taught; the model determines *how* it is explained.

**Document isolation:** When a student selects specific documents, the search query includes an OData filter on `documentId`. Chunks from unselected documents are never retrieved.

**Grounded refusal:** If the retrieved chunks don't contain enough evidence to answer the question, the system sets `isGrounded: false` and responds with: *"I couldn't find enough information about this topic in your selected learning materials."* It does not invent an answer.

---

## Architecture

```
┌─────────────────────────────┐
│   React 18 + Vite + TS      │
│   Tailwind CSS               │
│   (Frontend — port 5173)     │
└──────────────┬──────────────┘
               │  /api proxy
               ▼
┌─────────────────────────────┐
│   Express Backend (Node)     │
│   TypeScript / ESM           │
│   (Server — port 3001)       │
└──┬─────────┬─────────┬──────┘
   │         │         │
   ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────────┐
│ Azure  │ │ Azure  │ │ Azure      │
│ OpenAI │ │ AI     │ │ Speech     │
│        │ │ Search │ │ Service    │
│ GPT-5.6│ │        │ │            │
│ Sol    │ │ Index: │ │ STT + TTS  │
│        │ │learning│ │ Korea      │
│ text-  │ │-chunks │ │ Central    │
│embedding│ │        │ │            │
│-3-small│ │        │ │            │
└────────┘ └────────┘ └────────────┘
```

The frontend communicates with the backend through a Vite reverse proxy on `/api`. All Azure credentials stay server-side — the frontend never sees API keys.

---

## Microsoft Azure / AI-103 services

| Service | How we use it |
|---|---|
| **Azure OpenAI — GPT-5.6 Sol** | Chat completions for grounded answers, quiz generation, AI Live Class teaching, and vision analysis |
| **Azure OpenAI — text-embedding-3-small** | 1536-dimensional embeddings for document chunks and query vectors |
| **Azure AI Search** | Hybrid search (vector + keyword) over the `learning-chunks` index with OData document filters |
| **Azure Speech — Speech-to-Text** | Transcribes student voice input during AI Live Class |
| **Azure Speech — Text-to-Speech** | Converts AI teacher responses to spoken audio (en-US-JennyNeural voice) |

**AI-103 concepts demonstrated:**

- **Generative AI**: GPT-5.6 Sol for structured educational responses
- **Embeddings**: text-embedding-3-small for semantic vector representations
- **Vector search**: HNSW cosine similarity on `contentVector` field
- **Hybrid retrieval**: Combined vector + full-text search with document-level filtering
- **RAG (Retrieval-Augmented Generation)**: Grounding model responses in retrieved course material
- **Multimodal / Vision**: Image analysis via multimodal chat completions
- **Speech**: Real-time STT and TTS via Azure Speech REST APIs
- **Responsible AI**: Grounded refusal, source citations, document isolation, no hallucination policy

---

## Course Topic Map and grounded teaching

The Course Topic Map creates a structured hierarchy from each document's indexed chunks. GPT-5.6 Sol analyzes chunk outlines and organizes them into Units → Sections → Concepts, each linked to specific chunk IDs and page ranges.

This creates a clear boundary:

- **What to teach** comes from the uploaded learning material (the chunks and their content).
- **How to explain it** comes from GPT-5.6 Sol (structured explanations, analogies, step-by-step breakdowns).

When a student selects a specific concept in the topic map, retrieval is scoped to that concept's chunk IDs. The AI Live Class uses this to plan a curriculum of 3–6 concepts and teaches them in order, staying within the document's content.

---

## Project structure

```
├── src/                          # React frontend
│   ├── components/
│   │   ├── workspace/            # Chat, message display, knowledge sidebar
│   │   ├── classroom/            # AI Live Class UI
│   │   ├── quiz/                 # Quiz generator and runner
│   │   ├── vision/               # Image upload and analysis view
│   │   ├── analytics/            # Learning Insights dashboard
│   │   ├── documents/            # Document upload and management
│   │   ├── visual/               # Flowchart / mind map / diagram views
│   │   ├── evaluation/           # Responsible AI modal, test suite modal
│   │   ├── layout/               # Sidebar, guided tour
│   │   ├── landing/              # Landing page
│   │   ├── common/               # Shared UI components
│   │   └── settings/             # Settings panel
│   ├── services/                 # Frontend API clients
│   ├── context/                  # React context providers
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Utility functions
├── server/                       # Express backend
│   ├── index.ts                  # API routes and server entry point
│   ├── config.ts                 # Azure configuration and health check
│   ├── test-suite.ts             # RAG verification test suite
│   └── services/
│       ├── ragPipeline.ts        # Document ingestion, retrieval, answering
│       ├── azureOpenAIService.ts # Azure OpenAI REST client
│       ├── azureSearchService.ts # Azure AI Search indexing and querying
│       ├── speechService.ts      # Azure Speech STT and TTS
│       ├── aiClassService.ts     # AI Live Class session management
│       ├── courseTopicMapService.ts # Topic map generation and caching
│       ├── analyticsService.ts   # Event tracking and insights computation
│       ├── chunker.ts            # Page-aware document chunking
│       ├── documentParser.ts     # PDF and text extraction
│       ├── documentProfiler.ts   # Document topic/subject profiling
│       ├── visualService.ts      # Flowchart/mindmap/diagram generation
│       ├── studySessionService.ts # Self-paced study sessions
│       └── pdfExportService.ts   # PDF export for notes and transcripts
├── scripts/                      # Diagnostic and testing scripts
├── public/                       # Static assets
├── .env.example                  # Environment variable template
└── package.json
```

---

## Setup

```bash
git clone https://github.com/HRXMN0/LearnSphere.git
cd LearnSphere
npm install
```

Create `server/.env` with your Azure credentials:

```env
PORT=3001

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<your-resource>.services.ai.azure.com/
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5.6-sol
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=2024-06-01

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://<your-search-service>.search.windows.net
AZURE_SEARCH_API_KEY=
AZURE_SEARCH_INDEX=learning-chunks
AZURE_SEARCH_API_VERSION=2024-07-01

# Document Processing
DOCUMENT_PROCESSING_MODE=local

# Azure Speech
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=koreacentral
```

> **⚠️ `server/.env` must never be committed to version control.** It contains Azure API keys. The `.gitignore` should exclude it.

---

## Running the project

```bash
# Start the Vite dev server (frontend)
npm run dev

# Start the Express backend (in a separate terminal)
npm run server
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to the backend on port 3001.

---

## Testing

The project includes a RAG verification test suite:

```bash
npm run test:rag
```

This runs `server/test-suite.ts`, which executes:

| Test | What it verifies |
|---|---|
| **Chunking Schema** | Generated chunks match the `learning-chunks` index schema (id, documentId, documentName, pageNumber, chunkIndex, content) |
| **Test 1** | Upload and index a new document into Azure AI Search |
| **Test 2** | Grounded RAG answer with real page-level citations |
| **Test 3** | Out-of-scope question triggers grounded refusal (not hallucination) |
| **Test 4** | Second document coexists with the first in the same index |
| **Test 5** | Document isolation — filtering by documentId prevents cross-document retrieval |
| **Test 6** | Document deletion purges chunks from the index |
| **Test 7** | Dynamic quiz generation from retrieved document chunks |
| **Test 8** | Invalid/empty file upload is rejected cleanly |
| **Test 9** | Missing Azure credentials produce a configuration error, not a mock fallback |

Tests 1–7 require live Azure credentials. Tests 8, 9, and Chunking Schema run without credentials.

---

## Responsible AI

Measures implemented in the current codebase:

- **API keys stay server-side.** The frontend never handles Azure credentials.
- **Document-scoped retrieval.** Answers are filtered to the student's selected documents only.
- **Grounded answers with citations.** Every response includes the source document name and page number.
- **Grounded refusal.** When evidence is insufficient, the system says so instead of making something up.
- **No mock fallback.** If Azure services are unavailable, the system returns an explicit configuration error — it does not generate fake answers.
- **Transparency.** Responses are clearly AI-generated. Students are expected to verify important information against their original materials.
- **Quiz evaluation is server-side.** Scoring happens on the backend to prevent client-side manipulation.

---

## Limitations

- **Scanned PDFs** (image-only pages) will produce little or no extracted text since the current parser (`pdf-parse`) does not perform OCR.
- **All features require configured Azure services.** Without valid Azure OpenAI, AI Search, and Speech keys, the application cannot function.
- **Voice workflows have latency.** The round-trip through Azure Speech STT → RAG retrieval → GPT generation → Azure Speech TTS adds noticeable delay during AI Live Class.
- **Azure free-tier quotas** may throttle requests under heavy use.
- **Session data is in-memory.** AI Live Class sessions and study sessions are stored in server memory and are lost on server restart. Analytics events are persisted to a local JSON file.
- **Topic map generation** requires a GPT call per document, which can take several seconds for large documents.

---

## Future improvements

- **OCR integration** (e.g., Azure Document Intelligence) for scanned PDFs and handwritten notes.
- **Persistent session storage** using a database instead of in-memory maps.
- **Multi-language support** for speech and document processing beyond English.
- **Collaborative features** — sharing topic maps or quiz results between students.
- **Streaming responses** to reduce perceived latency for long answers and AI Live Class teaching.
- **Fine-grained access control** if deployed for multiple users or classrooms.

---

## Team / Project context

LearnSphere was built as a university capstone project for the **AI-103: Azure AI Engineer** course. The goal was to demonstrate practical use of Azure AI services (OpenAI, AI Search, Speech, Vision) in a real application that solves an actual student problem — studying from course materials with traceable, grounded AI assistance.
