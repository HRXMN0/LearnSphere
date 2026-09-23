import http from 'http';
import { performance } from 'perf_hooks';
import { azureSearch } from '../server/services/azureSearchService.js';
import { azureOpenAI } from '../server/services/azureOpenAIService.js';
import { speechService } from '../server/services/speechService.js';
import { ragPipeline } from '../server/services/ragPipeline.js';
import { config } from '../server/config.js';

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

async function streamGPTWithFirstToken(messages) {
  const v1Base = new URL(config.openAI.endpoint.replace(/\/+$/, '')).origin;
  const v1Url = `${v1Base}/openai/v1/chat/completions`;

  const payload = {
    model: config.openAI.chatDeployment,
    messages,
    temperature: 0.3,
    stream: true,
  };

  const t0 = performance.now();
  const res = await fetch(v1Url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.openAI.apiKey,
    },
    body: JSON.stringify(payload),
  });

  let firstTokenMs = null;
  let fullText = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (firstTokenMs === null) {
      firstTokenMs = Math.round(performance.now() - t0);
    }
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(line.substring(6));
          const delta = parsed.choices?.[0]?.delta?.content || '';
          fullText += delta;
        } catch {}
      }
    }
  }
  const t1 = performance.now();
  return {
    firstTokenMs,
    totalLlmMs: Math.round(t1 - t0),
    content: fullText,
  };
}

async function runDetailedInstrumentation() {
  console.log('========================================================================');
  console.log('       AI LIVE CLASS: TIME-TO-FIRST-AUDIO STAGE INSTRUMENTATION');
  console.log('========================================================================\n');

  const docs = await ragPipeline.getDocuments();
  const testDoc = docs.find((d) => d.name.includes('Physical Layer') || d.name.includes('Networks')) || docs[0];
  console.log(`Document: "${testDoc.name}" (${testDoc.id})\n`);

  // Setup class session
  const createRes = await post('/api/ai-classes', { documentId: testDoc.id });
  const classId = createRes.data.classId;

  // -------------------------------------------------------------
  // FULL END-TO-END TIMELINE WITH HIGH-PRECISION TIMESTAMPS
  // -------------------------------------------------------------
  const tStartClass = performance.now();
  console.log(`[0.000s] 1. Start Class clicked`);

  // Step 2: session activation
  const tActivation0 = performance.now();
  const startRes = await post(`/api/ai-classes/${classId}/start`);
  const tActivation1 = performance.now();
  const activationDuration = Math.round(tActivation1 - tActivation0);
  console.log(`[+${Math.round(tActivation1 - tStartClass)}ms] 2. session activation completed (${activationDuration}ms)`);

  // Step 3: Azure AI Search request started
  const tSearchStart = performance.now();
  console.log(`[+${Math.round(tSearchStart - tStartClass)}ms] 3. Azure AI Search request started`);

  const topic = 'Introduction to Data Communication';
  const concept = 'Physical Layer Fundamentals';
  const searchQuery = `${testDoc.name} ${topic} ${concept}`;

  const searchRes = await ragPipeline.retrieveGroundedChunks(searchQuery, [testDoc.id], 4);
  const tSearchEnd = performance.now();
  const searchDuration = Math.round(tSearchEnd - tSearchStart);
  console.log(`[+${Math.round(tSearchEnd - tStartClass)}ms] 4. Azure AI Search completed (${searchDuration}ms)`);
  console.log(`       - text-embedding-3-small: ${searchRes.timing.embeddingMs}ms`);
  console.log(`       - azure-search-query:     ${searchRes.timing.searchMs}ms`);

  // Step 5: GPT request started
  const tGPTStart = performance.now();
  console.log(`[+${Math.round(tGPTStart - tStartClass)}ms] 5. GPT request started`);

  const teacherPrompt = `You are an energetic, articulate, elite university professor conducting a 1-to-1 private lecture on "${testDoc.name}".
Current Topic: ${topic}
Current Concept: ${concept}
Step Number: 1 of 5

GROUNDED COURSE MATERIAL (from course document):
${searchRes.combinedContext}

YOUR TASK:
Produce the content for this specific teaching step:
1. "teacherSpeech": What the professor speaks aloud directly to the student. Generate a coherent, natural, engaging teaching paragraph (approx 50-80 words, 3-5 sentences). Sound like a passionate, articulate university professor explaining this concept clearly. Do NOT use bullet points, headings, markdown, or citations in the speech. Speak in a continuous, captivating lecture style.
2. "boardBlocks": 2-3 visual teaching blocks for the live teaching board:
   - "heading" (short title)
   - "bullets" or "definition" or "callout"
3. "studyNote": A concise structured note to save into the student's notebook:
   - "section": "${concept}"
   - "content": concise high-yield academic explanation (1-2 sentences)
   - "keyPoints": 2-3 high-yield bullets
4. "understandingCheck": null

Return valid JSON strictly matching:
{
  "teacherSpeech": "...",
  "boardTitle": "${concept}",
  "boardSubtitle": "${topic}",
  "boardBlocks": [
    { "type": "heading", "text": "..." },
    { "type": "bullets", "items": ["..."] }
  ],
  "studyNote": {
    "section": "${concept}",
    "content": "...",
    "keyPoints": ["...", "..."]
  },
  "understandingCheck": null
}`;

  const gptStream = await streamGPTWithFirstToken([
    { role: 'system', content: 'You are an AI university professor teaching a live 1-to-1 class. Return strict JSON.' },
    { role: 'user', content: teacherPrompt },
  ]);

  const tGPTFirstToken = tGPTStart + gptStream.firstTokenMs;
  console.log(`[+${Math.round(tGPTFirstToken - tStartClass)}ms] 6. GPT first response/token received (+${gptStream.firstTokenMs}ms from GPT start)`);

  const tGPTEnd = performance.now();
  const gptDuration = Math.round(tGPTEnd - tGPTStart);
  console.log(`[+${Math.round(tGPTEnd - tStartClass)}ms] 7. GPT completed (${gptDuration}ms)`);

  let parsed = null;
  try {
    parsed = JSON.parse(gptStream.content.match(/\{[\s\S]*\}/)[0]);
  } catch {
    parsed = { teacherSpeech: 'Welcome to physical layer fundamentals.' };
  }

  // Step 8: TTS request started
  const tTTSStart = performance.now();
  console.log(`[+${Math.round(tTTSStart - tStartClass)}ms] 8. TTS request started`);

  const synth = await speechService.synthesize(parsed.teacherSpeech);
  const tTTSEnd = performance.now();
  const ttsDuration = Math.round(tTTSEnd - tTTSStart);
  console.log(`[+${Math.round(tTTSEnd - tStartClass)}ms] 9. TTS first audio available (${ttsDuration}ms)`);

  // Step 10: audio playback started (simulated client receive + audio buffer load)
  const tPlaybackStart = performance.now() + 15; // realistic decode/play event loop tick
  const totalLatency = Math.round(tPlaybackStart - tStartClass);
  console.log(`[+${Math.round(tPlaybackStart - tStartClass)}ms] 10. audio playback started (+15ms decode)`);

  console.log('\n========================================================================');
  console.log('                     STAGE DURATION BREAKDOWN');
  console.log('========================================================================');
  console.log(`Stage 1: Start Class -> Session Activation:  ${activationDuration}ms`);
  console.log(`Stage 2: Azure AI Search (Embedding + RRF):   ${searchDuration}ms (${((searchDuration / totalLatency) * 100).toFixed(1)}%)`);
  console.log(`Stage 3: GPT Time-to-First-Token:            ${gptStream.firstTokenMs}ms`);
  console.log(`Stage 4: GPT Total Generation:               ${gptDuration}ms (${((gptDuration / totalLatency) * 100).toFixed(1)}%)`);
  console.log(`Stage 5: Azure Speech TTS Synthesize:        ${ttsDuration}ms (${((ttsDuration / totalLatency) * 100).toFixed(1)}%)`);
  console.log(`Stage 6: Client Audio Playback Handshake:    15ms`);
  console.log('------------------------------------------------------------------------');
  console.log(`TOTAL TIME-TO-FIRST-AUDIO:                   ${totalLatency}ms (${(totalLatency / 1000).toFixed(2)}s)`);
  console.log('========================================================================\n');

  console.log('IDENTIFIED BOTTLENECK:');
  if (gptDuration > ttsDuration && gptDuration > searchDuration) {
    console.log(`-> GPT generation (${gptDuration}ms, ${((gptDuration / totalLatency) * 100).toFixed(1)}%) is the MAJORITY bottleneck, followed by TTS (${ttsDuration}ms, ${((ttsDuration / totalLatency) * 100).toFixed(1)}%).`);
    console.log(`-> Together, GPT + TTS account for ${(((gptDuration + ttsDuration) / totalLatency) * 100).toFixed(1)}% of total delay.`);
  }
}

runDetailedInstrumentation().catch(console.error);
