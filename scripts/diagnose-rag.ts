import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3001';

async function runDiagnostics() {
  console.log('================================================================');
  console.log('STARTING COMPLETE END-TO-END RAG PIPELINE DIAGNOSTIC');
  console.log('================================================================\n');

  // Check health
  const healthRes = await fetch(`${API_BASE}/api/health`);
  const health = await healthRes.json();
  console.log('[System Health]', health);

  // -------------------------------------------------------------
  // PHASE 1 & 2: INGESTION OF REAL PDF
  // -------------------------------------------------------------
  const pdfPath = 'D:/CNDC/1. Introduction to Computer Networks.pdf';
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`Test PDF not found at ${pdfPath}`);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const fileName = '1. Introduction to Computer Networks.pdf';
  console.log(`\n[Phase 1 Upload] Uploading ${fileName} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);

  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, fileName);

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(`Upload failed (${uploadRes.status}): ${JSON.stringify(err)}`);
  }

  const uploadData = await uploadRes.json();
  const doc = uploadData.document;
  console.log(`[Phase 1 Complete] Ingestion took ${((Date.now() - uploadStart) / 1000).toFixed(1)}s`);
  console.log('  - Original Filename:', doc.name);
  console.log('  - Generated DocumentId:', doc.id);
  console.log('  - Pages Parsed:', doc.pages);
  console.log('  - Chunks Generated & Indexed:', doc.chunksCount);
  console.log('  - Status:', doc.status);

  const primaryDocId = doc.id;

  // -------------------------------------------------------------
  // PHASE 3, 4, 5, 6, 7, 8, 9: TEST QUESTIONS
  // -------------------------------------------------------------
  const testQuestions = [
    'What is computer networks?',
    'What is data communication?',
    'What are the components of a communication system?',
    'Explain the basic concepts introduced in this document.',
    'Summarize the introduction to computer networks.',
    'Explain TCP.',
  ];

  console.log('\n================================================================');
  console.log('PHASE 9: RUNNING TEST QUESTIONS AGAINST UPLOADED PDF');
  console.log('================================================================\n');

  const questionResults: any[] = [];

  for (const q of testQuestions) {
    console.log(`\n--- QUERY: "${q}" ---`);
    const chatRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: q,
        documentIds: [primaryDocId],
      }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.json();
      console.error('Chat error:', err);
      continue;
    }

    const resData = await chatRes.json();
    const isGrounded = resData.isGrounded;
    const citations = resData.citations || [];
    const pages = citations.map((c: any) => c.pageNumber);
    const scores = citations.map((c: any) => c.searchScore);

    console.log(`  Is Grounded: ${isGrounded}`);
    console.log(`  Retrieved Chunks: ${resData.retrievedChunks?.length || 0}`);
    console.log(`  Citations Count: ${citations.length}`);
    console.log(`  Cited Pages: [${pages.join(', ')}]`);
    console.log(`  Scores: [${scores.map((s: number) => s.toFixed(4)).join(', ')}]`);
    console.log(`  Answer snippet:\n    ${resData.answer.substring(0, 300).replace(/\n/g, '\n    ')}...\n`);

    questionResults.push({
      question: q,
      isGrounded,
      chunkCount: resData.retrievedChunks?.length || 0,
      citationCount: citations.length,
      pages,
      scores,
      answerSnippet: resData.answer.substring(0, 150),
    });
  }

  // -------------------------------------------------------------
  // PHASE 10: NEGATIVE GROUNDING TEST
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('PHASE 10: NEGATIVE GROUNDING TEST (Chocolate Cake Recipe)');
  console.log('================================================================\n');

  const negativeQuestion = 'What is the recipe for chocolate cake?';
  const negRes = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: negativeQuestion,
      documentIds: [primaryDocId],
    }),
  });

  const negData = await negRes.json();
  console.log(`Question: "${negativeQuestion}"`);
  console.log(`Is Grounded: ${negData.isGrounded}`);
  console.log(`Citations Count: ${(negData.citations || []).length}`);
  console.log(`Answer:\n  "${negData.answer}"`);

  // -------------------------------------------------------------
  // PHASE 11: MULTI-DOCUMENT ISOLATION TEST
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('PHASE 11: MULTI-DOCUMENT ISOLATION TEST');
  console.log('================================================================\n');

  const docBContent = `Operating System Scheduling and Deadlocks Study Notes
Page 1: An operating system manages computer hardware and system resources.
A CPU scheduler determines which process in the ready queue is allocated the CPU.
Common scheduling algorithms include First-Come First-Served (FCFS), Shortest Job Next (SJN), and Round Robin (RR).
Page 2: A deadlock is a state where a set of processes are blocked because each process is holding a resource and waiting for another resource acquired by some other process.
The four Coffman conditions for deadlock are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.`;

  const formB = new FormData();
  formB.append('file', new Blob([docBContent], { type: 'text/plain' }), 'OS_Scheduling_Notes.txt');

  const uploadBRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formB,
  });

  const docB = (await uploadBRes.json()).document;
  console.log(`Uploaded Document B: ${docB.name} (id: ${docB.id})`);

  // Query A asking about networks with Doc A filter
  const testA = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'what is computer networks',
      documentIds: [primaryDocId],
    }),
  });
  const dataA = await testA.json();
  const citedDocsA = Array.from(new Set((dataA.citations || []).map((c: any) => c.documentId)));
  console.log(`Query "what is computer networks" (Filter: Doc A only):`);
  console.log(`  Cited doc IDs: ${citedDocsA.join(', ')} (Expected: only ${primaryDocId})`);
  console.log(`  Passed isolation: ${citedDocsA.every((id) => id === primaryDocId)}`);

  // Query B asking about Deadlocks with Doc B filter
  const testB = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What are the four Coffman conditions for deadlock?',
      documentIds: [docB.id],
    }),
  });
  const dataB = await testB.json();
  const citedDocsB = Array.from(new Set((dataB.citations || []).map((c: any) => c.documentId)));
  console.log(`Query "Coffman conditions for deadlock" (Filter: Doc B only):`);
  console.log(`  Cited doc IDs: ${citedDocsB.join(', ')} (Expected: only ${docB.id})`);
  console.log(`  Passed isolation: ${citedDocsB.every((id) => id === docB.id)}`);
  console.log(`  Answer snippet:\n    ${dataB.answer.substring(0, 200).replace(/\n/g, '\n    ')}...`);

  // Cross test: Ask about deadlocks with Doc A filter (should refuse)
  const testCross = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'What are the four Coffman conditions for deadlock?',
      documentIds: [primaryDocId],
    }),
  });
  const dataCross = await testCross.json();
  console.log(`Query "Coffman conditions" (Filter: Doc A only - negative cross-test):`);
  console.log(`  Is Grounded: ${dataCross.isGrounded}`);
  console.log(`  Citations Count: ${(dataCross.citations || []).length}`);
  console.log(`  Refused as expected: ${!dataCross.isGrounded}`);

  console.log('\n================================================================');
  console.log('ALL DIAGNOSTICS COMPLETE!');
  console.log('================================================================');
}

runDiagnostics().catch((err) => {
  console.error('DIAGNOSTICS FAILED:', err);
  process.exit(1);
});
