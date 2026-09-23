import { performance } from 'perf_hooks';
import { config } from '../server/config.js';

const testText = "Welcome to our live class! Today we explore the physical layer, which is responsible for transmitting raw bit streams over a physical medium.";

const formats = [
  'audio-16khz-128kbitrate-mono-mp3',
  'audio-16khz-64kbitrate-mono-mp3',
  'audio-16khz-32kbitrate-mono-mp3',
  'audio-24khz-48kbitrate-mono-mp3',
  'audio-24khz-96kbitrate-mono-mp3',
];

async function testFormat(fmt) {
  const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='en-US-JennyNeural'>${testText}</voice></speak>`;
  const url = `https://${config.speech.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  const t0 = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.speech.key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': fmt,
      'User-Agent': 'MultimodalLearningAssistant',
    },
    body: ssml,
  });
  const buf = await res.arrayBuffer();
  const t1 = performance.now();
  console.log(`Format: ${fmt.padEnd(35)} -> ${Math.round(t1 - t0)}ms | ${buf.byteLength} bytes`);
}

async function run() {
  console.log('Testing Azure Speech TTS formats:');
  for (const f of formats) {
    try {
      await testFormat(f);
    } catch (e) {
      console.error(f, e.message);
    }
  }
}

run();
