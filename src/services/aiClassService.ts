import { AIClassSession } from '../types/aiClass';

export const AIClassAPI = {
  async createClass(documentId: string): Promise<AIClassSession> {
    const res = await fetch('/api/ai-classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) throw new Error('Failed to create AI class');
    return res.json();
  },

  async getClass(classId: string): Promise<AIClassSession> {
    const res = await fetch(`/api/ai-classes/${classId}`);
    if (!res.ok) throw new Error('Failed to fetch AI class');
    return res.json();
  },

  async startClass(classId: string): Promise<{ session: AIClassSession; ready: boolean }> {
    const res = await fetch(`/api/ai-classes/${classId}/start`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to start AI class');
    return res.json();
  },

  async executeStep(
    classId: string,
    stepIndex?: number
  ): Promise<{ session: AIClassSession; audioUrl?: string; wasPrefetched?: boolean }> {
    const res = await fetch(`/api/ai-classes/${classId}/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepIndex }),
    });
    if (!res.ok) throw new Error('Failed to execute lecture step');
    return res.json();
  },

  async prefetchNextStep(
    classId: string,
    stepIndex?: number
  ): Promise<{ success: boolean; prefetchedIndex?: number }> {
    try {
      const res = await fetch(`/api/ai-classes/${classId}/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepIndex }),
      });
      if (!res.ok) return { success: false };
      return res.json();
    } catch {
      return { success: false };
    }
  },

  async nextStep(
    classId: string
  ): Promise<{ session: AIClassSession; audioUrl?: string; wasPrefetched?: boolean }> {
    const res = await fetch(`/api/ai-classes/${classId}/next-step`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to advance lecture step');
    return res.json();
  },

  async interrupt(
    classId: string,
    question: string
  ): Promise<{ session: AIClassSession; teacherResponse: string; audioUrl?: string }> {
    const res = await fetch(`/api/ai-classes/${classId}/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error('Failed to process student interruption');
    return res.json();
  },

  async answerCheck(
    classId: string,
    answer: string
  ): Promise<{ session: AIClassSession; feedback: string; isCorrect: boolean }> {
    const res = await fetch(`/api/ai-classes/${classId}/answer-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    if (!res.ok) throw new Error('Failed to evaluate understanding check');
    return res.json();
  },

  async pauseClass(classId: string): Promise<AIClassSession> {
    const res = await fetch(`/api/ai-classes/${classId}/pause`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to pause class');
    return res.json();
  },

  async resumeClass(classId: string): Promise<AIClassSession> {
    const res = await fetch(`/api/ai-classes/${classId}/resume`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to resume class');
    return res.json();
  },

  async endClass(classId: string): Promise<AIClassSession> {
    const res = await fetch(`/api/ai-classes/${classId}/end`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to end class');
    return res.json();
  },

  getExportNotesPdfUrl(classId: string): string {
    return `/api/ai-classes/${classId}/export/notes-pdf`;
  },

  getExportTranscriptPdfUrl(classId: string): string {
    return `/api/ai-classes/${classId}/export/transcript-pdf`;
  },

  getExportTxtUrl(classId: string): string {
    return `/api/ai-classes/${classId}/export/txt`;
  },

  async appendNotes(classId: string, file?: File): Promise<Blob> {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    const res = await fetch(`/api/ai-classes/${classId}/append-notes`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to append notes to original PDF');
    return res.blob();
  },
};
