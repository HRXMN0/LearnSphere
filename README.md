# LearnSphere
### AI Academic Learning Workspace — Learn from your documents. Understand your images. Ask anything.

A university evaluation-ready AI educational workspace powered by **Microsoft Foundry**, **Azure OpenAI (`gpt-5.6-sol`)**, **Azure OpenAI Embeddings (`text-embedding-3-small`)**, **Azure AI Search (`learning-chunks`)**, **Azure Speech**, and **Vision**.

Built for the **AI-103 Azure AI Engineer / Cognitive Services** evaluation rubric.

---

## 1. Problem
Students and learners frequently struggle with dense, unstructured technical course materials (syllabi, lecture notes, textbook chapters, network packet captures, system architecture diagrams). Generic chatbots hallucinate facts, invent fake citations, cannot verify page numbers, lack multimodal understanding of course diagrams, and fail to distinguish when a question is outside the scope of their assigned curriculum.

---

## 2. Solution
**LearnSphere** bridges this gap by delivering:
- **Grounded RAG with Hallucination Mitigation**: Retrieval-Augmented Generation strictly anchored in user-uploaded course documents with verifiable, page-level citations.
- **Strict Grounding Refusal ("I Don't Know" behavior)**: Explicit refusal to guess or hallucinate when requested information is absent from selected documents.
- **Robust Document Isolation**: Granular multi-document selection with Azure AI Search `vectorFilterMode: "preFilter"` on `documentId` preventing cross-talk between distinct subjects.
- **Dynamic Quiz Generation**: Auto-generated diagnostic assessments constructed directly from retrieved course material chunks using Azure OpenAI.
- **AI Live Class**: Grounded interactive classroom experience where an AI instructor leads discussions, verifies comprehension, and generates downloadable lecture notes.
- **Multimodal Visual Analysis Pipeline**: Structured breakdown and educational explanation of technical diagrams, protocol sequences, and labels using Azure OpenAI.
- **Course Topic Maps**: Dynamic Unit → Section → Concept hierarchical breakdown grounded directly in indexed documents.
- **Real-Time Insights & Mastery**: Data-driven learning analytics tracking questions, document ingestion, quiz scores, and diagnostic study hours.

---

## 3. Architecture
```
                                 ┌───────────────────────────────┐
                                 │       React 18 + Vite         │
                                 │   Tailwind CSS / TypeScript   │
                                 │      (Frontend Port 5173)     │
                                 └───────────────┬───────────────┘
                                                 │ Reverse Proxy (/api)
                                                 ▼
                                 ┌───────────────────────────────┐
                                 │        Express Backend        │
                                 │     TypeScript / Node ESM     │
                                 │      (Server Port 3001)       │
                                 └───────┬───────────────┬───────┘
                                         │               │
                 ┌───────────────────────┘               └──────────────────────┐
                 ▼                                                              ▼
   ┌───────────────────────────┐                                  ┌───────────────────────────┐
   │    Document Ingestion     │                                  │   RAG & Query Pipeline    │
   │  - Multer Memory Storage  │                                  │  - Query Embeddings Gen   │
   │  - Local PDF Parsing      │                                  │  - Hybrid Search Filter   │
   │  - Token-Safe Chunking    │                                  │  - Grounding Refusal Guard│
   └─────────────┬─────────────┘                                  └─────────────┬─────────────┘
                 │                                                              │
                 ▼                                                              ▼
   ┌───────────────────────────┐                                  ┌───────────────────────────┐
   │    Azure OpenAI Service   │                                  │      Azure AI Search      │
   │ - text-embedding-3-small  │ ◄────── Embeddings / Vectors ──► │  - Service: learning-     │
   │   (1536 dims, Global Std) │                                  │    assistant-search       │
   │ - gpt-4.1-mini            │ ◄────── Grounded Generation ──── │  - Index: learning-chunks │
   │   (Foundry proj-default)  │                                  │  - HNSW Cosine Similarity │
   └───────────────────────────┘                                  └───────────────────────────┘
```

---

## 4. Data Flow

### Ingestion Flow (`POST /api/documents/upload`):
1. **Upload & Validation**: User uploads PDF/text document (validated for MIME type and 45MB limit).
2. **Local Text Extraction**: Extracted page-by-page preserving accurate physical page numbers.
3. **Chunking**: Chunked deterministically into ~600 token blocks with ~90 token overlap.
4. **Vector Embedding**: Each chunk text is sent to Azure OpenAI `text-embedding-3-small` returning a 1536-dimensional embedding vector.
5. **Search Indexing**: Chunks and vectors are batch-uploaded to Azure AI Search index `learning-chunks`.

### Retrieval & Answering Flow (`POST /api/chat`):
1. **Query Embedding**: The user question is vectorized via `text-embedding-3-small`.
2. **Azure AI Search Retrieval**: Hybrid query (Vector search on `contentVector` + full-text search) filtered by active `documentId`s using `vectorFilterMode: "preFilter"`.
3. **Evidence-Based Grounding Guard**: If no chunks are retrieved or if the retrieved chunks lack sufficient evidence, the system triggers the grounded refusal message rather than guessing.
4. **Grounded Synthesis**: Retrieved chunk text is passed as context to `gpt-4.1-mini` with strict system grounding constraints.
5. **Citation Construction**: The backend constructs citations directly from retrieved search documents (`documentId`, `documentName`, `pageNumber`).

---

## 5. Actual Azure Services & Deployments
- **Microsoft Foundry Project**: `proj-default`
- **Chat Deployment**:
  - Deployment Name: `gpt-4.1-mini`
  - Model: GPT-4.1 Mini
  - Deployment Type: Global Standard
  - Status: Succeeded
- **Embedding Deployment**:
  - Deployment Name: `text-embedding-3-small`
  - Model: Text Embedding 3 Small
  - Dimensions: 1536
  - Deployment Type: Global Standard
  - Status: Succeeded
- **Azure AI Search**:
  - Service Name: `learning-assistant-search`
  - Endpoint: `https://learning-assistant-search.search.windows.net`
  - Region: UAE North (Free Tier)
  - Index Name: `learning-chunks`

---

## 6. Search Index Schema (`learning-chunks`)
The Azure AI Search index `learning-chunks` is structured as follows:

| Field Name | Type | Key | Searchable | Filterable | Sortable | Retrievable | Description |
|---|---|---|---|---|---|---|---|
| `id` | `Edm.String` | Yes | No | No | No | Yes | Unique chunk identifier (`${docId}_${chunkIndex}`) |
| `documentId` | `Edm.String` | No | No | Yes | No | Yes | Parent document ID for isolation filtering |
| `documentName` | `Edm.String` | No | No | Yes | No | Yes | Original file name for citations |
| `pageNumber` | `Edm.Int32` | No | No | Yes | Yes | Yes | Source page number from source PDF |
| `chunkIndex` | `Edm.Int32` | No | No | Yes | Yes | Yes | Chunk order index within document |
| `content` | `Edm.String` | No | Yes | No | No | Yes | Searchable chunk text body |
| `contentVector` | `Collection(Edm.Single)` | No | No (Vector Searchable) | No | No | No | 1536-dimensional HNSW cosine vector |

*Vector algorithm parameters: HNSW, m=4, efConstruction=400, efSearch=500, Cosine metric.*

---

## 7. Hybrid Search & Relevance Gating Implementation

### Candidate Selection
The search pipeline performs hybrid retrieval combining dense vector similarity (`contentVector`) and full-text keyword matching.

### Document Isolation via Pre-Filter
When specific documents are selected, the query applies an OData filter:
```json
{
  "search": "query terms",
  "filter": "(documentId eq 'doc_1') or (documentId eq 'doc_2')",
  "vectorQueries": [
    {
      "kind": "vector",
      "vector": [/* 1536-dim embedding */],
      "fields": "contentVector",
      "k": 4,
      "vectorFilterMode": "preFilter"
    }
  ]
}
```
Setting `vectorFilterMode: "preFilter"` guarantees that Azure AI Search eliminates non-matching documents **before** nearest-neighbor vector candidates are computed, preventing cross-document contamination.

### Score Semantics (RRF vs Cosine)
Azure AI Search hybrid search uses **Reciprocal Rank Fusion (RRF)**:
$$\text{RRF Score} = \sum_{m \in M} \frac{1}{60 + r_m}$$
Because hybrid `@search.score` represents rank reciprocal sums (typically between `0.01` and `0.04`) rather than normalized cosine similarities (`0.0` to `1.0`), the system **does not** apply a naive numerical score cutoff on the RRF score.

### Grounding & Refusal Logic
Relevance gating is implemented as an evidence-based decision:
1. **Index Match Check**: If Azure AI Search returns 0 chunks matching the pre-filtered query, the system immediately refuses to answer without calling the LLM.
2. **Context-Grounded Evidence Decision**: When candidate chunks are returned, `gpt-4.1-mini` is instructed with mandatory grounding rules:
   - Answer using *only* facts present in the retrieved context.
   - If the context does not contain sufficient evidence to answer reliably, emit the standardized refusal:
     > *"I couldn't find enough information about this topic in your selected learning materials."*
3. **Citation Cleansing**: Whenever the refusal message is issued, `citations` are cleared (`[]`) and `isGrounded` is flagged `false`.

---

## 8. Citation Design
- Citations are **never generated by the LLM**; they are assembled directly by the backend from retrieved Azure AI Search documents.
- Structure:
  ```json
  {
    "documentId": "doc_1726938210_a8bc",
    "documentName": "Computer-Networks-Transport-Layer.pdf",
    "pageNumber": 14,
    "chunkId": "doc_1726938210_a8bc_3",
    "excerpt": "TCP initiates connection teardown using FIN segments...",
    "searchScore": 0.0328
  }
  ```
- Clicking any citation in the UI opens the Source Preview Modal with a 4-step retrieval breakdown (Query Vectorization → Search Indexing → Semantic Chunk → Grounded LLM Response).

---

## 9. API Versions Actually Used
- **Azure OpenAI**: Uses current Azure OpenAI v1 REST routing (`/openai/v1/embeddings`, `/openai/v1/chat/completions`) with deployment passed in the request payload (`model: gpt-4.1-mini`), with automatic fallback to `/openai/deployments/{deployment}/...` for compatibility across both Foundry project endpoints and Azure OpenAI resources.
- **Azure AI Search**: Uses stable General Availability vector search API version `2024-07-01` (`/indexes/{index}/docs/search?api-version=2024-07-01`), supporting `vectorQueries`, `contentVector`, and `vectorFilterMode: "preFilter"`.

---

## 10. Local Setup & Environment Configuration

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd multimodal-learning-assistant

# Install frontend and backend dependencies
npm install
```

### Environment Variables
Azure credentials are kept exclusively server-side in `server/.env` (which is gitignored). 

Create `server/.env` with your real Azure credentials:
```env
PORT=3001

# Azure OpenAI / Microsoft Foundry
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4.1-mini
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# Azure AI Search (UAE North / Free Tier)
AZURE_SEARCH_ENDPOINT=https://learning-assistant-search.search.windows.net
AZURE_SEARCH_API_KEY=your_azure_search_admin_key_here
AZURE_SEARCH_INDEX=learning-chunks

# Document Processing Mode
DOCUMENT_PROCESSING_MODE=local
```

> **Security Note**: Never commit `server/.env` to source control. `.env.example` contains placeholders only.

---

## 11. Running Frontend & Backend

### Start Backend (Port 3001):
```bash
npm run server
```

### Start Frontend (Port 5173):
```bash
npm run dev
```
The Vite development server runs on `http://localhost:5173` with an automatic proxy forwarding `/api` calls to `http://localhost:3001`.

---

## 12. Verification Status & Test Suite

### Status by Capability:
| Capability | Implementation Status | Live Verification Status |
|---|---|---|
| **Health Check (`GET /api/health`)** | Implemented | **VERIFIED LIVE** (Connected to OpenAI & Search, index: `learning-chunks`) |
| **Input Validation & Error Boundaries** | Implemented | **VERIFIED LIVE** (Rejects empty files & invalid inputs cleanly) |
| **Schema Compliance (`learning-chunks`)** | Implemented | **VERIFIED LIVE** (1536-dim vector, deterministic chunking) |
| **RAG Ingestion (`POST /api/documents/upload`)** | Implemented | **VERIFIED LIVE** (`text-embedding-3-small` embeddings + Azure AI Search indexation) |
| **RAG Retrieval & Chat (`POST /api/chat`)** | Implemented | **VERIFIED LIVE** (Hybrid retrieval + `gpt-4.1-mini` grounded response + citations) |
| **Document Isolation (`documentId` filter)** | Implemented | **VERIFIED LIVE** (Restricts candidates to active documents only) |
| **Document Deletion (`DELETE /api/documents/:id`)** | Implemented | **VERIFIED LIVE** (Purges all document chunks from Azure AI Search) |
| **Dynamic Quiz Generation (`POST /api/quiz`)** | Implemented | **VERIFIED LIVE** (Generated dynamically from retrieved chunk context) |
| **Multimodal Vision (`POST /api/vision/analyze`)** | Implemented | **VERIFIED LIVE** (`gpt-4.1-mini` multimodal diagram analysis via base64) |

### Automated Test Suite:
Run the verification test suite:
```bash
npm run test:rag
```
The test suite validates:
1. **TEST 8 (Invalid file validation)**: Empty/corrupted files rejected with clean 400 error. [PASS]
2. **TEST 9 (Azure credentials verification)**: Confirms active credentials and connection. [PASS]
3. **CHUNKING SCHEMA**: Deterministic chunking strictly matching `learning-chunks` schema. [PASS]
4. **TEST 1 (Real Ingestion)**: Ingests new text document, generates 1536-dim embeddings via `text-embedding-3-small`, and indexes in `learning-chunks`. [PASS]
5. **TEST 4 (Document Coexistence)**: Ingests second document; verifies multiple documents coexist in index. [PASS]
6. **TEST 2 (Grounded Question)**: Answers supported question with verified source citation and page number. [PASS]
7. **TEST 3 (Refusal on Out-of-Scope)**: Refuses to guess or hallucinate when context lacks evidence. [PASS]
8. **TEST 5 (Document Isolation)**: Selected Document A does not retrieve Document B content. [PASS]
9. **TEST 7 (Dynamic Quiz Generation)**: Generates MCQs dynamically from retrieved chunks. [PASS]
10. **TEST 6 (Document Deletion)**: Purges all chunks for deleted document from Azure AI Search. [PASS]

---

## 13. Responsible AI & Transparency
- **Credential Safety**: No API keys or secrets are ever exposed to the client-side bundle or logged to stdout.
- **Hallucination Mitigation**: Low temperature (`0.2`), strict system prompt grounding, and automated refusal when evidence is absent.
- **Citation Transparency**: Page-level auditability allows students to verify every claim against their original syllabus or textbook.
- **AI-Generated Content Disclaimers**: UI explicitly notes that responses and quizzes are AI-generated and should be checked when accuracy matters.

---

## 14. Limitations
- **Local PDF Parsing**: Scanned PDFs that consist solely of raster images without embedded text layers require OCR before indexing.
- **Token Quota**: Azure Free Tier Search and Global Standard quota may throttle high-frequency parallel batch indexing.
- **Live Credentials Required**: In LIVE mode, the application requires real Azure keys; it will not fabricate mock responses when unconfigured.

---

## 15. Third-Party Resources & Licenses
- **React 18**: MIT License
- **Vite**: MIT License
- **Tailwind CSS**: MIT License
- **Lucide Icons**: ISC License
- **pdf-parse**: MIT License
- **Express**: MIT License
