import { performance } from 'perf_hooks';
import { azureSearch } from '../server/services/azureSearchService.js';
import { azureOpenAI } from '../server/services/azureOpenAIService.js';
import { speechService } from '../server/services/speechService.js';
import { ragPipeline } from '../server/services/ragPipeline.js';

async function runBenchmark() {
  console.log('================================================================');
  console.log('  BENCHMARK: TIME-TO-FIRST-AUDIO OPTIMIZATION EXPERIMENT');
  console.log('================================================================\n');

  const docs = await ragPipeline.getDocuments();
  const testDoc = docs.find((d) => d.name.includes('Physical Layer') || d.name.includes('Networks')) || docs[0];
  console.log(`Document: "${testDoc.name}" (${testDoc.id})\n`);

  const topic = 'Introduction to Data Communication';
  const concept = 'Physical Layer Fundamentals';
  const query = `${testDoc.name} ${topic} ${concept}`;

  // -------------------------------------------------------------
  // Test A: Current Baseline (Top 4 chunks, Serial All-in-One LLM, then TTS)
  // -------------------------------------------------------------
  console.log('--- TEST A: Current Baseline (Serial Single LLM + TTS) ---');
  const tA0 = performance.now();
  
  const searchA0 = performance.now();
  const resA = await ragPipeline.retrieveGroundedChunks(query, [testDoc.id], 4);
  const searchA1 = performance.now();

  const llmA0 = performance.now();
  const promptA = `You are an AI university professor teaching a live 1-to-1 class on "${testDoc.name}".
Current Topic: ${topic}
Current Concept: ${concept}
Step Number: 1 of 5

GROUNDED COURSE MATERIAL:
${resA.combinedContext}

YOUR TASK:
Return strict JSON with:
1. "teacherSpeech": 50-80 words engaging explanation.
2. "boardBlocks": 2 visual blocks with heading and bullets.
3. "studyNote": section, content, keyPoints.
4. "understandingCheck": null

JSON:
{
  "teacherSpeech": "...",
  "boardTitle": "${concept}",
  "boardSubtitle": "${topic}",
  "boardBlocks": [{ "type": "heading", "text": "..." }, { "type": "bullets", "items": ["..."] }],
  "studyNote": { "section": "${concept}", "content": "...", "keyPoints": ["..."] },
  "understandingCheck": null
}`;

  const rawA = await azureOpenAI.generateCompletion([
    { role: 'system', content: 'You are an AI professor. Return strict JSON.' },
    { role: 'user', content: promptA }
  ]);
  const parsedA = JSON.parse(rawA.match(/\{[\s\S]*\}/)[0]);
  const llmA1 = performance.now();

  const ttsA0 = performance.now();
  const synthA = await speechService.synthesize(parsedA.teacherSpeech);
  const ttsA1 = performance.now();
  const tA_total = performance.now() - tA0;

  console.log(`  Search (top 4): ${Math.round(searchA1 - searchA0)}ms`);
  console.log(`  LLM (all-in-one JSON): ${Math.round(llmA1 - llmA0)}ms`);
  console.log(`  TTS (serial):   ${Math.round(ttsA1 - ttsA0)}ms`);
  console.log(`  TOTAL BASELINE: ${Math.round(tA_total)}ms\n`);

  // -------------------------------------------------------------
  // Test B: Decoupled & Parallelized (Top 2 chunks, Speech-First LLM -> Parallel [TTS, Board LLM])
  // -------------------------------------------------------------
  console.log('--- TEST B: Optimized (Top 2 chunks, Speech-First + Parallel TTS & Board) ---');
  const tB0 = performance.now();

  // 1. Search with minimum required chunks (2 chunks)
  const searchB0 = performance.now();
  const resB = await ragPipeline.retrieveGroundedChunks(query, [testDoc.id], 2);
  const searchB1 = performance.now();

  // 2. Speech-First LLM: Only generate teacherSpeech + concise board title
  const llmSpeechB0 = performance.now();
  const speechPrompt = `You are an articulate university professor teaching a live 1-to-1 lecture on "${testDoc.name}".
Current Topic: ${topic}
Current Concept: ${concept}

GROUNDED COURSE MATERIAL:
${resB.combinedContext}

Generate the professor's spoken lecture for this concept (concise, captivating, natural paragraph of 45-65 words, 3-4 sentences). Sound clear and engaging. Do not use bullet points or markdown.

Return valid JSON:
{
  "boardTitle": "${concept}",
  "teacherSpeech": "..."
}`;

  const rawSpeech = await azureOpenAI.generateCompletion([
    { role: 'system', content: 'You are an elite professor teaching live. Return strict JSON.' },
    { role: 'user', content: speechPrompt }
  ]);
  const parsedSpeech = JSON.parse(rawSpeech.match(/\{[\s\S]*\}/)[0]);
  const llmSpeechB1 = performance.now();

  // 3. Immediately launch TTS AND in parallel launch Board/Notes generation!
  const parallel0 = performance.now();

  const ttsPromise = speechService.synthesize(parsedSpeech.teacherSpeech);

  const boardPrompt = `Based on this concept "${concept}" and teacher explanation:
"${parsedSpeech.teacherSpeech}"

Create the live teaching board blocks and study note.
Return strict JSON:
{
  "boardBlocks": [
    { "type": "heading", "text": "${concept}" },
    { "type": "bullets", "items": ["Key concept point 1", "Key concept point 2"] }
  ],
  "studyNote": {
    "section": "${concept}",
    "content": "One sentence summary of this concept.",
    "keyPoints": ["point 1", "point 2"]
  }
}`;

  const boardPromise = azureOpenAI.generateCompletion([
    { role: 'system', content: 'You are a teaching assistant formatting board and notes. Return strict JSON.' },
    { role: 'user', content: boardPrompt }
  ]).then(raw => JSON.parse(raw.match(/\{[\s\S]*\}/)[0]));

  const [synthB, boardData] = await Promise.all([ttsPromise, boardPromise]);
  const parallel1 = performance.now();
  const tB_total = performance.now() - tB0;

  console.log(`  Search (top 2):     ${Math.round(searchB1 - searchB0)}ms`);
  console.log(`  Speech LLM:         ${Math.round(llmSpeechB1 - llmSpeechB0)}ms`);
  console.log(`  Parallel [TTS & Board]: ${Math.round(parallel1 - parallel0)}ms`);
  console.log(`  TOTAL OPTIMIZED:    ${Math.round(tB_total)}ms\n`);

  console.log('================================================================');
  console.log(`LATENCY REDUCTION: ${Math.round(tA_total)}ms -> ${Math.round(tB_total)}ms (${Math.round(((tA_total - tB_total) / tA_total) * 100)}% faster)`);
  console.log('================================================================');
}

runBenchmark().catch(console.error);
