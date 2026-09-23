import { config } from '../config';

export class AzureSpeechService {
  public isConfigured(): boolean {
    return config.speech.isConfigured;
  }

  /**
   * Cleans text for natural speech synthesis:
   * Strips markdown, code blocks, citations, URLs, and XML control characters.
   */
  public cleanTextForSpeech(rawText: string): string {
    let clean = rawText
      // Strip markdown code fences
      .replace(/```[\s\S]*?```/g, 'Code excerpt omitted.')
      // Strip inline code
      .replace(/`([^`]+)`/g, '$1')
      // Strip markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Strip bold / italics
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Strip markdown headings
      .replace(/^#{1,6}\s+/gm, '')
      // Strip bullet points and list markers
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Strip citation brackets like [Page 42] or [Source: ...]
      .replace(/\[(?:Source|Chunk|Page)[^\]]*\]/gi, '')
      // Strip excessive newlines and whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Cap at reasonable duration (~1500 chars) for responsive TTS playback
    if (clean.length > 1800) {
      const sentenceCut = clean.slice(0, 1800).lastIndexOf('.');
      clean = sentenceCut > 1200 ? clean.slice(0, sentenceCut + 1) : clean.slice(0, 1800) + '...';
    }

    return clean;
  }

  /**
   * Escapes XML characters for safe SSML payload.
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Real Azure Speech-to-Text via REST API.
   * Transcribes microphone audio buffer into text.
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    clientMimeType: string
  ): Promise<{ text: string; confidence?: number; duration?: string }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure Speech Service is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env.'
      );
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('No audio data received for transcription.');
    }

    // Determine normalized Content-Type for Azure Speech API
    let contentType = 'audio/webm; codecs=opus';
    const lower = clientMimeType.toLowerCase();
    if (lower.includes('wav')) {
      contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
    } else if (lower.includes('ogg')) {
      contentType = 'audio/ogg; codecs=opus';
    } else if (lower.includes('mp3') || lower.includes('mpeg')) {
      contentType = 'audio/mpeg';
    } else if (lower.includes('webm')) {
      contentType = 'audio/webm; codecs=opus';
    }

    const url = `https://${config.speech.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

    console.log(`[Azure Speech STT] Transcribing ${audioBuffer.length} bytes (MIME: ${contentType}, region: ${config.speech.region})...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.speech.key,
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure Speech STT Error] HTTP ${response.status}: ${errorText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Azure Speech authentication failed. Check AZURE_SPEECH_KEY in server/.env.');
      }
      throw new Error(`Azure Speech-to-Text failed (${response.status}): ${errorText.substring(0, 150)}`);
    }

    const data = await response.json();
    console.log(`[Azure Speech STT Result] Status: ${data.RecognitionStatus}, Text: "${data.DisplayText || data.Text || ''}"`);

    if (data.RecognitionStatus === 'Success') {
      const text = (data.DisplayText || data.Text || '').trim();
      if (!text) {
        throw new Error('No speech detected in audio. Please try speaking again.');
      }
      return { text, duration: data.Duration };
    }

    if (data.RecognitionStatus === 'NoMatch') {
      throw new Error('No clear speech was recognized in the recording. Please speak clearly into your microphone.');
    }

    if (data.RecognitionStatus === 'InitialSilenceTimeout') {
      throw new Error('No speech detected before timeout. Please speak immediately when recording starts.');
    }

    throw new Error(`Speech recognition could not interpret audio (Status: ${data.RecognitionStatus}).`);
  }

  /**
   * Real Azure Speech Text-to-Speech via REST API.
   * Synthesizes text into high-fidelity neural MP3 audio.
   */
  async synthesizeSpeech(rawText: string): Promise<{ audioBuffer: Buffer; contentType: string }> {
    if (!this.isConfigured()) {
      throw new Error(
        'Azure Speech Service is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env.'
      );
    }

    const cleanText = this.cleanTextForSpeech(rawText);
    if (!cleanText) {
      throw new Error('No speakable text provided for synthesis.');
    }

    const escaped = this.escapeXml(cleanText);
    const ssml = `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' xml:gender='Female' name='en-US-JennyNeural'>${escaped}</voice></speak>`;

    const url = `https://${config.speech.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    console.log(`[Azure Speech TTS] Synthesizing ${cleanText.length} characters (region: ${config.speech.region})...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.speech.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'MultimodalLearningAssistant',
      },
      body: ssml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure Speech TTS Error] HTTP ${response.status}: ${errorText}`);
      if (response.status === 401 || response.status === 403) {
        throw new Error('Azure Speech authentication failed. Check AZURE_SPEECH_KEY in server/.env.');
      }
      throw new Error(`Azure Text-to-Speech failed (${response.status}): ${errorText.substring(0, 150)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    console.log(`[Azure Speech TTS Success] Generated ${audioBuffer.length} bytes of audio/mpeg.`);
    return {
      audioBuffer,
      contentType: 'audio/mpeg',
    };
  }

  async synthesize(rawText: string): Promise<{ success: boolean; audioBuffer?: Buffer; contentType?: string; audioDataUrl?: string }> {
    try {
      const res = await this.synthesizeSpeech(rawText);
      const audioDataUrl = `data:${res.contentType};base64,${res.audioBuffer.toString('base64')}`;
      return { success: true, audioBuffer: res.audioBuffer, contentType: res.contentType, audioDataUrl };
    } catch (err) {
      console.warn('[Azure Speech Synthesize Error]', err);
      return { success: false };
    }
  }
}

export const azureSpeech = new AzureSpeechService();
export const speechService = azureSpeech;
