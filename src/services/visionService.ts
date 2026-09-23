import { VisionAnalysis } from '../types/vision';
import { DEMO_VISION_ANALYSIS } from '../data/demoData';

export interface IVisionService {
  analyzeImage(imageInput: { name: string; url?: string; fileObj?: File; imageBase64?: string; mimeType?: string }): Promise<VisionAnalysis>;
  askQuestionAboutImage(imageInput: { fileObj?: File; imageBase64?: string; mimeType?: string }, question: string, context?: string): Promise<string>;
  indexVisionAnalysis(analysis: VisionAnalysis, imageName: string): Promise<{ document: any; message: string }>;
  getDemoAnalysis(): Promise<VisionAnalysis>;
}

export class RealVisionService implements IVisionService {
  async getDemoAnalysis(): Promise<VisionAnalysis> {
    return {
      ...DEMO_VISION_ANALYSIS,
      isDemo: true,
      fileName: 'tcp-handshake-example.png',
      fileSize: 'Example Diagram',
    };
  }

  async analyzeImage(imageInput: { name: string; url?: string; fileObj?: File; imageBase64?: string; mimeType?: string }): Promise<VisionAnalysis> {
    if (!imageInput.fileObj && !imageInput.imageBase64) {
      throw new Error('No image provided for visual analysis. Please upload an image file.');
    }

    let response: Response;

    if (imageInput.fileObj) {
      const formData = new FormData();
      formData.append('image', imageInput.fileObj);
      formData.append('fileName', imageInput.name);
      formData.append('prompt', 'Analyze this technical diagram, components, sequence flow, and labels in detail.');

      response = await fetch('/api/vision/analyze', {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageInput.imageBase64,
          mimeType: imageInput.mimeType || 'image/png',
          fileName: imageInput.name,
          prompt: 'Analyze this technical diagram, components, sequence flow, and labels in detail.',
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `Vision analysis failed with status ${response.status}`);
    }

    const data = await response.json();
    const analysisPayload = data.analysis || data;

    return {
      id: data.imageId || `vision-${Date.now()}`,
      title: analysisPayload.title || imageInput.name,
      imageUrl: imageInput.url || 'uploaded-image',
      fileName: data.fileName || imageInput.name,
      fileSize: data.fileSize || 'Uploaded File',
      mimeType: data.mimeType || imageInput.mimeType || 'image/png',
      isDemo: false,
      isIndexedInRAG: false,
      capabilities: ['VISION', 'GENERATIVE AI'],
      whatISee: analysisPayload.whatISee || 'Visual technical analysis of uploaded diagram.',
      keyConcepts: Array.isArray(analysisPayload.keyConcepts) ? analysisPayload.keyConcepts : [],
      stepByStep: (analysisPayload.stepByStep || []).map((s: any, idx: number) => ({
        stepNumber: s.stepNumber || idx + 1,
        title: s.title || `Step ${idx + 1}`,
        description: s.description || '',
        senderReceiver: s.senderReceiver,
      })),
      importantLabels: (analysisPayload.importantLabels || []).map((l: any) => ({
        tag: l.tag || 'Component',
        description: l.description || '',
        category: 'concept',
      })),
      detailedExplanation: analysisPayload.detailedExplanation || analysisPayload.whatISee || '',
    };
  }

  async askQuestionAboutImage(
    imageInput: { fileObj?: File; imageBase64?: string; mimeType?: string },
    question: string,
    context?: string
  ): Promise<string> {
    let response: Response;

    if (imageInput.fileObj) {
      const formData = new FormData();
      formData.append('image', imageInput.fileObj);
      formData.append('question', question);
      if (context) formData.append('context', context);

      response = await fetch('/api/vision/ask', {
        method: 'POST',
        body: formData,
      });
    } else if (imageInput.imageBase64) {
      response = await fetch('/api/vision/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageInput.imageBase64,
          mimeType: imageInput.mimeType || 'image/png',
          question,
          context,
        }),
      });
    } else {
      throw new Error('Image is required to ask questions about this visual.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || 'Failed to answer question about image.');
    }

    const data = await response.json();
    return data.answer || 'No answer generated.';
  }

  async indexVisionAnalysis(
    analysis: VisionAnalysis,
    imageName: string
  ): Promise<{ document: any; message: string }> {
    const response = await fetch('/api/vision/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis,
        imageName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || 'Failed to index visual analysis into Azure AI Search.');
    }

    return await response.json();
  }
}

export const visionService = new RealVisionService();
