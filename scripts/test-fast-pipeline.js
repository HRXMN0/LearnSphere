import { performance } from 'perf_hooks';
import { azureOpenAI } from '../server/services/azureOpenAIService.js';
import { speechService } from '../server/services/speechService.js';
import { ragPipeline } from '../server/services/ragPipeline.js';

async function testFastPipeline() {
  const docs = await ragPipeline.getDocuments();
  const testDoc = docs[0];

  const query = `${testDoc.name} Physical Layer`;
  const tSearch0 = performance.now();
  const res = await ragPipeline.retrieveGroundedChunks(query, [testDoc.id], 2);
  const searchMs = Math.round(performance.now() - tSearch0);

  // Approach 1: Streamlined single prompt returning concise speech + key points
  const t0 = performance.now();
  const prompt = `You are a university professor teaching live on "${testDoc.name}".
Concept: Physical Layer Fundamentals
Course Context:
${res.combinedContext}

Return strict JSON:
{
  "teacherSpeech": "Engaging lecture explanation (45-60 words).",
  "keyPoints": ["Key point 1", "Key point 2"]
}`;

  const raw = await azureOpenAI.generateCompletion([
    { role: 'system', content: 'You are an AI professor. Return strict JSON.' },
    { role: 'user', content: prompt }
  ]);
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
  const gptMs = Math.round(performance.now() - t0);

  const tTTS0 = performance.now();
  const synth = await speechService.synthesize(parsed.teacherSpeech);
  const ttsMs = Math.round(performance.now() - tTTS0);

  console.log(`Search (top 2 chunks): ${searchMs}ms`);
  console.log(`GPT (concise speech + points): ${gptMs}ms`);
  console.log(`TTS (24kHz MP3): ${ttsMs}ms`);
  console.log(`TOTAL PIPELINE: ${searchMs + gptMs + ttsMs}ms`);
  console.log(`Teacher Speech (${parsed.teacherSpeech.length} chars): "${parsed.teacherSpeech}"`);
  console.log(`Key Points:`, parsed.keyPoints);
}

testFastPipeline().catch(console.error);
