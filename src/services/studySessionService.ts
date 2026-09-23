import { StudySession, ConversationTurn } from '../types/studySession';

export const StudySessionAPI = {
  async createSession(documentId: string): Promise<StudySession> {
    const res = await fetch('/api/study-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) throw new Error('Failed to create study session');
    return res.json();
  },

  async getSession(sessionId: string): Promise<StudySession> {
    const res = await fetch(`/api/study-sessions/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch study session');
    return res.json();
  },

  async addTurn(
    sessionId: string,
    text: string,
    generateAudio = true
  ): Promise<{ userTurn: ConversationTurn; assistantTurn: ConversationTurn }> {
    const res = await fetch(`/api/study-sessions/${sessionId}/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, generateAudio }),
    });
    if (!res.ok) throw new Error('Failed to send question');
    return res.json();
  },

  async endSession(sessionId: string): Promise<StudySession> {
    const res = await fetch(`/api/study-sessions/${sessionId}/end`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to end study session');
    return res.json();
  },

  getExportTxtUrl(sessionId: string): string {
    return `/api/study-sessions/${sessionId}/export/txt`;
  },

  getExportJsonUrl(sessionId: string): string {
    return `/api/study-sessions/${sessionId}/export/json`;
  },

  getExportPdfUrl(sessionId: string): string {
    return `/api/study-sessions/${sessionId}/export/pdf`;
  },

  async appendTranscript(sessionId: string, file?: File): Promise<Blob> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    const res = await fetch(`/api/study-sessions/${sessionId}/append-transcript`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to append transcript to PDF');
    return res.blob();
  },
};
