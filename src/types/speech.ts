export type SpeechInputState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'TRANSCRIBED' | 'ERROR';

export type SpeechAudioState = 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';

export interface SpeechTranscriptionResult {
  success: boolean;
  transcript: string;
  durationMs?: number;
  language?: string;
  error?: string;
}

export interface SpeechSynthesisResult {
  success: boolean;
  audioUrl?: string;
  audioBlob?: Blob;
  durationMs?: number;
  error?: string;
}
