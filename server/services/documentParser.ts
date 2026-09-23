import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocumentResult {
  title: string;
  totalPages: number;
  pages: ParsedPage[];
  fullText: string;
}

/**
 * Extracts real text and page structure from an uploaded PDF buffer.
 * Distinguishes local extraction layer from future Azure Content Understanding service.
 */
export async function parsePdfBuffer(
  buffer: Buffer,
  fileName: string
): Promise<ParsedDocumentResult> {
  const pages: ParsedPage[] = [];

  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const totalPages = result.total || result.pages?.length || 1;

    if (result.pages && Array.isArray(result.pages) && result.pages.length > 0) {
      for (let i = 0; i < result.pages.length; i++) {
        const p = result.pages[i];
        const pageText = (p.text || '').trim();
        if (pageText.length > 0) {
          pages.push({
            pageNumber: p.num || (i + 1),
            text: pageText,
          });
        }
      }
    }

    // Fallback if pages array was empty but full text exists
    if (pages.length === 0 && result.text && result.text.trim().length > 0) {
      const rawPages = result.text.split(/\f/);
      if (rawPages.length > 1) {
        rawPages.forEach((pageText: string, idx: number) => {
          if (pageText.trim().length > 0) {
            pages.push({
              pageNumber: idx + 1,
              text: pageText.trim(),
            });
          }
        });
      } else {
        pages.push({
          pageNumber: 1,
          text: result.text.trim(),
        });
      }
    }

    await parser.destroy();

    const fullText = result.text || pages.map((p) => p.text).join('\n\n');

    return {
      title: fileName,
      totalPages: Math.max(totalPages, pages.length),
      pages,
      fullText,
    };
  } catch (error: any) {
    console.error('PDF parsing error in documentParser:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Parses plain text / markdown study material
 */
export function parseTextBuffer(
  buffer: Buffer,
  fileName: string
): ParsedDocumentResult {
  const content = buffer.toString('utf-8');
  return {
    title: fileName,
    totalPages: 1,
    pages: [{ pageNumber: 1, text: content }],
    fullText: content,
  };
}
