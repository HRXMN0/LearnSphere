import { ParsedPage } from './documentParser';

export interface DocumentChunk {
  id: string;              // Key in Azure AI Search index
  documentId: string;      // Filterable
  documentName: string;    // Filterable
  pageNumber: number;      // Int32, filterable, sortable
  chunkIndex: number;      // Int32, filterable, sortable
  content: string;         // Searchable text
  contentVector?: number[];// Collection(Edm.Single), 1536 dimensions
}

export interface ChunkingOptions {
  maxChunkCharacters?: number; // ~500-900 tokens ≈ 2000-3600 characters
  overlapCharacters?: number;  // ~80-150 tokens ≈ 320-600 characters
}

/**
 * Splits extracted pages into structured chunks strictly matching the Azure AI Search
 * index schema for "learning-chunks".
 * 
 * Schema:
 * - id (String, key)
 * - documentId (String, filterable)
 * - documentName (String, filterable)
 * - pageNumber (Int32, filterable, sortable)
 * - chunkIndex (Int32, filterable, sortable)
 * - content (String, searchable)
 * - contentVector (Collection(Edm.Single), 1536 dims)
 */
export function chunkDocumentPages(
  documentId: string,
  documentName: string,
  pages: ParsedPage[],
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const maxChars = options.maxChunkCharacters || 2400; // ~600 tokens
  const overlap = options.overlapCharacters || 360;    // ~90 tokens
  const chunks: DocumentChunk[] = [];

  let globalChunkIndex = 0;

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    // Split page text into paragraph blocks
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunkText = '';

    for (const para of paragraphs) {
      const cleanPara = para.replace(/\s+/g, ' ').trim();
      if (!cleanPara) continue;

      if ((currentChunkText + ' ' + cleanPara).length <= maxChars) {
        currentChunkText = currentChunkText ? `${currentChunkText}\n\n${cleanPara}` : cleanPara;
      } else {
        if (currentChunkText) {
          globalChunkIndex++;
          const safeId = `${documentId}_${globalChunkIndex}`.replace(/[^a-zA-Z0-9_\-=]/g, '_');
          chunks.push({
            id: safeId,
            documentId,
            documentName,
            pageNumber: page.pageNumber,
            chunkIndex: globalChunkIndex,
            content: currentChunkText.trim(),
          });

          // Retain overlap from end of chunk
          const overlapText = currentChunkText.slice(-overlap);
          currentChunkText = `${overlapText}\n\n${cleanPara}`;
        } else {
          // Paragraph itself exceeds maxChars, slice it
          let remaining = cleanPara;
          while (remaining.length > 0) {
            globalChunkIndex++;
            const slice = remaining.substring(0, maxChars);
            const safeId = `${documentId}_${globalChunkIndex}`.replace(/[^a-zA-Z0-9_\-=]/g, '_');
            chunks.push({
              id: safeId,
              documentId,
              documentName,
              pageNumber: page.pageNumber,
              chunkIndex: globalChunkIndex,
              content: slice.trim(),
            });
            remaining = remaining.substring(maxChars - overlap);
            if (remaining.length <= overlap) break;
          }
          currentChunkText = '';
        }
      }
    }

    if (currentChunkText.trim()) {
      globalChunkIndex++;
      const safeId = `${documentId}_${globalChunkIndex}`.replace(/[^a-zA-Z0-9_\-=]/g, '_');
      chunks.push({
        id: safeId,
        documentId,
        documentName,
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex,
        content: currentChunkText.trim(),
      });
    }
  }

  return chunks;
}
