import http from 'http';
import { performance } from 'perf_hooks';

function post(path, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3001,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3001' + path, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runProfile() {
  console.log('======================================================================');
  console.log('  PROFILING TIME-TO-FIRST-AUDIO (STAGE-BY-STAGE MEASUREMENT)');
  console.log('======================================================================\n');

  const docRes = await get('/api/documents');
  const docs = docRes.data.documents;
  const testDoc = docs.find((d) => d.name.includes('Physical Layer') || d.name.includes('Networks')) || docs[0];
  console.log(`Document: "${testDoc.name}" (${testDoc.id}, ${testDoc.pages} pages)\n`);

  // 1. Session Creation
  const tCreate0 = performance.now();
  const createRes = await post('/api/ai-classes', { documentId: testDoc.id });
  const tCreate1 = performance.now();
  const classId = createRes.data.classId;
  console.log(`[Stage 1] Class Creation: ${Math.round(tCreate1 - tCreate0)}ms`);

  // 2. Start Class
  const tStart0 = performance.now();
  const startRes = await post(`/api/ai-classes/${classId}/start`);
  const tStart1 = performance.now();
  console.log(`[Stage 2] Session Activation (/start): ${Math.round(tStart1 - tStart0)}ms`);

  // 3. Step 1 (Detailed Profiling via server)
  const tStep0 = performance.now();
  const stepRes = await post(`/api/ai-classes/${classId}/next-step`);
  const tStep1 = performance.now();
  const totalStepMs = Math.round(tStep1 - tStep0);

  console.log(`[Stage 3] First Lesson Generation (Total): ${totalStepMs}ms`);

  if (stepRes.data.timing) {
    console.log('\n--- SERVER-SIDE INTERNAL BREAKDOWN ---');
    console.log(`  • Query Embedding:       ${stepRes.data.timing.embeddingMs}ms`);
    console.log(`  • Azure AI Search Query: ${stepRes.data.timing.searchMs}ms`);
    console.log(`  • Total Search/RAG:      ${stepRes.data.timing.searchTotalMs}ms`);
    console.log(`  • GPT-4.1-mini LLM:      ${stepRes.data.timing.llmMs}ms`);
    console.log(`  • Azure Speech TTS:      ${stepRes.data.timing.ttsMs}ms`);
    console.log(`  • Server Total:          ${stepRes.data.timing.serverTotalMs}ms`);
  }

  console.log('\n[Summary Metrics]');
  console.log(`Teacher Speech: "${stepRes.data.session.turns[0]?.text.substring(0, 100)}..."`);
  console.log(`Speech Length: ${stepRes.data.session.turns[0]?.text.length} chars`);
  console.log(`Audio Payload: ${(stepRes.data.audioUrl?.length / 1024).toFixed(1)} KB`);
  console.log(`Total Time-to-First-Audio: ${totalStepMs + Math.round(tStart1 - tStart0)}ms`);
}

runProfile().catch(console.error);
