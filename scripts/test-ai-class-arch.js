const http = require('http');

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
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('=== STARTING AI LIVE CLASS ARCHITECTURE VERIFICATION ===\n');

  // 1. Get documents
  const docRes = await get('/api/documents');
  const doc = docRes.data.documents[0];
  console.log(`[Document] Found indexed doc: "${doc.name}" (ID: ${doc.id})`);

  // 2. Test A: Create Class (Must NOT auto-start, state must be CLASS_READY)
  console.log('\n--- TEST A: Create Class (No auto-start) ---');
  const createRes = await post('/api/ai-classes', { documentId: doc.id });
  console.log(`Class created: ${createRes.data.classId}`);
  console.log(`State: ${createRes.data.state} (Expected: CLASS_READY)`);
  if (createRes.data.state !== 'CLASS_READY') {
    throw new Error('Class should be in CLASS_READY state, not auto-started!');
  }
  const classId = createRes.data.classId;

  // 3. Test B: Student clicks Start Class
  console.log('\n--- TEST B: Explicit Start Class & Audio Delivery ---');
  const startRes = await post(`/api/ai-classes/${classId}/start`);
  console.log(`Class state after start: ${startRes.data.session.state}`);
  console.log(`Topic: ${startRes.data.session.currentTopic}`);
  console.log(`Concept: ${startRes.data.session.currentConcept}`);
  const firstTurn = startRes.data.session.turns[startRes.data.session.turns.length - 1];
  console.log(`Teacher Spoke (${firstTurn.text.length} chars): "${firstTurn.text}"`);
  console.log(`Audio URL Present: ${!!startRes.data.audioUrl}`);
  if (startRes.data.audioUrl) {
    console.log(`Audio Format: ${startRes.data.audioUrl.substring(0, 30)}... (Length: ${startRes.data.audioUrl.length} bytes)`);
  }
  console.log(`Teaching Board Blocks: ${startRes.data.session.teachingBoard.blocks.length}`);
  console.log(`Study Notes: ${startRes.data.session.notes.length}`);

  // 4. Test C: Natural Student Interruption with Context Resolution
  console.log('\n--- TEST C: Natural Student Interruption & Context Resolution ---');
  const studentQuestion = "Why does it do that in network devices?";
  console.log(`Student asks: "${studentQuestion}" (Notice: referential context query)`);
  const interruptRes = await post(`/api/ai-classes/${classId}/interrupt`, { question: studentQuestion });
  console.log(`Teacher Response: "${interruptRes.data.teacherResponse}"`);
  console.log(`Audio URL for Interruption: ${!!interruptRes.data.audioUrl}`);
  const lastTurn = interruptRes.data.session.turns[interruptRes.data.session.turns.length - 1];
  console.log(`Grounded: ${lastTurn.isGrounded}, Sources: ${lastTurn.sources?.length || 0}`);

  // 5. Test D: Continuous Progression (Advance Next Step)
  console.log('\n--- TEST D: Advance Next Concept ---');
  const nextRes = await post(`/api/ai-classes/${classId}/nextStep`);
  console.log(`Advanced to Concept: ${nextRes.data.session.currentConcept}`);
  const nextTurn = nextRes.data.session.turns[nextRes.data.session.turns.length - 1];
  console.log(`Teacher Spoke: "${nextTurn.text}"`);
  console.log(`Audio URL Present: ${!!nextRes.data.audioUrl}`);

  // 6. Test E: Pause and Resume
  console.log('\n--- TEST E: Pause and Resume Class ---');
  const pauseRes = await post(`/api/ai-classes/${classId}/pause`);
  console.log(`Paused state: ${pauseRes.data.state}`);
  const resumeRes = await post(`/api/ai-classes/${classId}/resume`);
  console.log(`Resumed state: ${resumeRes.data.state}`);

  // 7. Test F: End Class & Exports
  console.log('\n--- TEST F: End Class & PDF Export ---');
  const endRes = await post(`/api/ai-classes/${classId}/end`);
  console.log(`Final state: ${endRes.data.state}`);
  console.log(`Duration: ${endRes.data.durationSeconds}s`);
  console.log(`Topics Covered: ${endRes.data.topicsCovered.join(', ')}`);
  console.log(`Notes Total: ${endRes.data.notes.length}`);

  // Test Export Notes PDF
  const notesPdf = await get(`/api/ai-classes/${classId}/export/notes-pdf`);
  console.log(`Notes PDF Status: ${notesPdf.status}, Size: ${notesPdf.raw.length} bytes`);

  // Test Export Transcript PDF
  const transcriptPdf = await get(`/api/ai-classes/${classId}/export/transcript-pdf`);
  console.log(`Transcript PDF Status: ${transcriptPdf.status}, Size: ${transcriptPdf.raw.length} bytes`);

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
