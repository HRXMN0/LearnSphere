import { performance } from 'perf_hooks';
import { config } from '../server/config.js';

async function testStreaming() {
  const v1Base = new URL(config.openAI.endpoint.replace(/\/+$/, '')).origin;
  const v1Url = `${v1Base}/openai/v1/chat/completions`;

  const payload = {
    model: config.openAI.chatDeployment,
    messages: [
      { role: 'system', content: 'You are a professor.' },
      { role: 'user', content: 'Explain physical layer in 50 words.' }
    ],
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

  console.log(`Stream connected: HTTP ${res.status}`);

  let firstTokenMs = null;
  let fullText = '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!firstTokenMs) {
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
  console.log(`First token: ${firstTokenMs}ms`);
  console.log(`Full completion: ${Math.round(t1 - t0)}ms`);
  console.log(`Total chars: ${fullText.length}`);
  console.log(`Text: "${fullText}"`);
}

testStreaming().catch(console.error);
