import { SpeechTranscriptionResult, SpeechSynthesisResult } from '../types/speech';

/**
 * Pure JavaScript utility to encode audio samples into 16kHz 16-bit linear PCM WAV
 * (the native format required by Azure Speech STT).
 */
function encodeWavPcm16(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * 1 * 16/8)
  view.setUint16(32, 2, true); // BlockAlign (1 * 16/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav; codecs=audio/pcm; samplerate=16000' });
}

export class BrowserAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Your browser does not support audio recording.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device found on your system.');
      }
      throw new Error(`Microphone access error: ${err.message || 'Unknown error'}`);
    }

    this.audioChunks = [];

    // Determine supported mimeType
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/wav')) {
      mimeType = 'audio/wav';
    }

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100);
  }

  async stopRecording(): Promise<Blob> {
    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('Recorder is not active.'));
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.onerror = (event: any) => {
        this.cleanup();
        reject(new Error(`Recording error: ${event.error?.message || 'Recording stopped unexpectedly'}`));
      };

      this.mediaRecorder.stop();
    });

    // Try converting the recorded blob to clean 16kHz WAV PCM for optimal Azure Speech recognition
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const arrayBuffer = await rawBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();

        // Resample/extract mono 16kHz
        const targetRate = 16000;
        const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetRate), targetRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);

        const renderedBuffer = await offlineCtx.startRendering();
        const channelData = renderedBuffer.getChannelData(0);

        return encodeWavPcm16(channelData, targetRate);
      }
    } catch (conversionErr) {
      console.warn('WAV resampling fallback to native blob:', conversionErr);
    }

    return rawBlob;
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export class SpeechService {
  /**
   * Check if Azure Speech Service is configured on the backend
   */
  static async checkConfig(): Promise<{ isConfigured: boolean; region?: string }> {
    try {
      const res = await fetch('/api/speech/config');
      if (!res.ok) return { isConfigured: false };
      return await res.json();
    } catch {
      return { isConfigured: false };
    }
  }

  /**
   * Transcribe recorded audio blob via Azure Speech STT backend endpoint
   */
  static async transcribe(audioBlob: Blob): Promise<SpeechTranscriptionResult> {
    if (audioBlob.size < 500) {
      throw new Error('Recording was too short or no speech was captured. Please speak clearly into your microphone.');
    }

    const formData = new FormData();
    const extension = audioBlob.type.includes('wav') ? 'wav' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    formData.append('audio', audioBlob, `speech_recording.${extension}`);

    const response = await fetch('/api/speech/transcribe', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Transcription failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    if (!data.transcript || data.transcript.trim() === '') {
      throw new Error('No speech detected. Please speak closer to your microphone and try again.');
    }

    return {
      success: true,
      transcript: data.transcript,
      durationMs: data.durationMs,
      language: data.language,
    };
  }

  /**
   * Synthesize text to speech via Azure Speech TTS backend endpoint
   */
  static async synthesize(text: string): Promise<SpeechSynthesisResult> {
    if (!text || text.trim() === '') {
      throw new Error('No text provided for speech synthesis.');
    }

    const response = await fetch('/api/speech/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let errorMsg = `Speech synthesis failed with status ${response.status}`;
      if (contentType.includes('application/json')) {
        const errJson = await response.json().catch(() => ({}));
        errorMsg = errJson.error || errJson.message || errorMsg;
      } else {
        const textErr = await response.text().catch(() => '');
        if (textErr) errorMsg = textErr;
      }
      throw new Error(errorMsg);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      success: true,
      audioUrl,
      audioBlob,
    };
  }
}
