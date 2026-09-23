import { LearningDocument, DocumentUploadSimulationStep, DocumentTopic, DocumentProfile, CourseTopicMap } from '../types/document';
import { DEMO_DOCUMENTS } from '../data/demoData';

export interface IDocumentService {
  getDocuments(): Promise<LearningDocument[]>;
  getDocumentTopics(documentId: string): Promise<DocumentTopic[]>;
  getDocumentProfile(documentId: string): Promise<DocumentProfile | null>;
  getCourseTopicMap(documentId: string): Promise<CourseTopicMap | null>;
  uploadDocument(
    file: File | { name: string; size: string; type: string; fileObj?: File },
    onProgress: (step: DocumentUploadSimulationStep) => void
  ): Promise<LearningDocument>;
  deleteDocument(id: string): Promise<boolean>;
}

export class RealDocumentService implements IDocumentService {
  private localDocs: LearningDocument[] = [];

  async getDocuments(): Promise<LearningDocument[]> {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const data = await response.json();
        const serverDocs: LearningDocument[] = (data.documents || []).map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type === 'pdf' ? 'pdf' : 'notes',
          size: doc.size,
          pages: doc.pages,
          sectionsCount: Math.ceil(doc.pages / 3),
          diagramsCount: 0,
          tablesCount: 0,
          uploadedAt: doc.uploadedAt,
          status: doc.status || 'ready',
          topicCategory: doc.profile?.subject || 'Course Material',
          description: doc.profile?.mainTopic ? `Topic: ${doc.profile.mainTopic} (${doc.chunksCount} chunks)` : `Real document indexed in Azure AI Search (${doc.chunksCount} chunks).`,
          profile: doc.profile,
        }));
        return serverDocs;
      }
    } catch (err) {
      console.warn('Could not fetch server documents:', err);
    }
    return this.localDocs;
  }

  async getDocumentTopics(documentId: string): Promise<DocumentTopic[]> {
    try {
      const response = await fetch(`/api/documents/${documentId}/topics`);
      if (response.ok) {
        const data = await response.json();
        return data.topics || [];
      }
    } catch (err) {
      console.warn(`Failed to fetch topics for document ${documentId}:`, err);
    }
    return [];
  }

  async getDocumentProfile(documentId: string): Promise<DocumentProfile | null> {
    try {
      const response = await fetch(`/api/documents/${documentId}/topics`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`Failed to fetch profile for document ${documentId}:`, err);
    }
    return null;
  }

  async getCourseTopicMap(documentId: string): Promise<CourseTopicMap | null> {
    try {
      const response = await fetch(`/api/documents/${documentId}/topic-map`);
      if (response.ok) {
        const data = await response.json();
        return data.topicMap || null;
      }
    } catch (err) {
      console.warn(`Failed to fetch topic map for document ${documentId}:`, err);
    }
    return null;
  }

  async uploadDocument(
    fileInput: File | { name: string; size: string; type: string; fileObj?: File },
    onProgress: (step: DocumentUploadSimulationStep) => void
  ): Promise<LearningDocument> {
    const isRealFile = fileInput instanceof File || (fileInput as any).fileObj instanceof File;
    const fileObj = fileInput instanceof File ? fileInput : (fileInput as any).fileObj;
    const fileName = fileInput.name;
    const fileSize = typeof fileInput.size === 'number' 
      ? `${(fileInput.size / (1024 * 1024)).toFixed(2)} MB` 
      : String(fileInput.size || '1.0 MB');

    onProgress({ step: 'uploading', label: 'Sending document to server...', progress: 20 });

    if (isRealFile && fileObj) {
      const formData = new FormData();
      formData.append('file', fileObj);

      onProgress({ step: 'reading', label: 'Parsing pages & structure with PDF parser...', progress: 45 });
      onProgress({ step: 'extracting', label: 'Generating semantic vector embeddings (1536-dim)...', progress: 70 });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Upload failed with status ${response.status}`);
      }

      onProgress({ step: 'indexing', label: 'Uploading chunks to Azure AI Search index "learning-chunks"...', progress: 90 });

      const data = await response.json();
      const serverDoc = data.document;

      const newDoc: LearningDocument = {
        id: serverDoc.id,
        name: serverDoc.name,
        type: serverDoc.name.endsWith('.pdf') ? 'pdf' : 'notes',
        size: serverDoc.size || fileSize,
        pages: serverDoc.pages || 1,
        sectionsCount: Math.ceil((serverDoc.pages || 1) / 3),
        diagramsCount: 0,
        tablesCount: 0,
        uploadedAt: serverDoc.uploadedAt || 'Just now',
        status: 'ready',
        topicCategory: serverDoc.profile?.subject || 'Course Material',
        description: serverDoc.profile?.mainTopic ? `Topic: ${serverDoc.profile.mainTopic} (${serverDoc.chunksCount} chunks)` : `Indexed in Azure AI Search: ${serverDoc.chunksCount} chunks across ${serverDoc.pages} pages.`,
        profile: serverDoc.profile,
      };

      onProgress({ step: 'ready', label: 'Your material is ready for grounded questions.', progress: 100 });
      this.localDocs.unshift(newDoc);
      return newDoc;
    } else {
      // If synthetic / demo document upload simulation
      onProgress({ step: 'reading', label: 'Reading document text...', progress: 50 });
      onProgress({ step: 'indexing', label: 'Indexing in local store...', progress: 85 });
      onProgress({ step: 'ready', label: 'Document ready.', progress: 100 });

      const newDoc: LearningDocument = {
        id: `doc-${Date.now()}`,
        name: fileName,
        type: fileName.endsWith('.pdf') ? 'pdf' : 'notes',
        size: fileSize,
        pages: 12,
        sectionsCount: 4,
        diagramsCount: 2,
        tablesCount: 1,
        uploadedAt: 'Just now',
        status: 'ready',
        topicCategory: 'Sample Study Material',
        description: 'Sample document ready for evaluation testing.',
      };
      this.localDocs.unshift(newDoc);
      return newDoc;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        this.localDocs = this.localDocs.filter((d) => d.id !== id);
        return true;
      }
    } catch (err) {
      console.warn('Failed to delete on server:', err);
    }
    this.localDocs = this.localDocs.filter((d) => d.id !== id);
    return true;
  }

  resetToDemo(): void {
    this.localDocs = [...DEMO_DOCUMENTS];
  }
}

export const documentService = new RealDocumentService();
