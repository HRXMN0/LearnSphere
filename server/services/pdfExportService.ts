import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ExportNoteItem {
  section: string;
  content: string;
  timestamp?: string;
  keyPoints?: string[];
  sources?: Array<{ documentName: string; pageNumber: number }>;
}

export interface ExportTurnItem {
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: Array<{ documentName: string; pageNumber: number }>;
}

export class PdfExportService {
  /**
   * Generates a clean, professionally formatted PDF for Study Notes
   */
  async generateNotesPdf(
    title: string,
    documentName: string,
    notes: ExportNoteItem[],
    summaryText?: string
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    let y = height - 50;
    const margin = 50;
    const contentWidth = width - margin * 2;

    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < 50) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
    };

    // Header Banner
    page.drawText('LEARNSPHERE · ACADEMIC STUDY NOTES', {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.23, 0.54), // Cobalt
    });
    y -= 18;

    page.drawText(title, {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;

    page.drawText(`Document: ${documentName}  |  Generated: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 25;

    // Divider
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 25;

    // Summary Section if present
    if (summaryText) {
      checkPageBreak(80);
      page.drawText('EXECUTIVE SUMMARY', {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.12, 0.23, 0.54),
      });
      y -= 16;

      const summaryLines = this.wrapText(summaryText, 80);
      for (const line of summaryLines) {
        checkPageBreak(16);
        page.drawText(line, {
          x: margin,
          y,
          size: 10,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= 14;
      }
      y -= 15;
    }

    // Notes Entries
    for (const note of notes) {
      checkPageBreak(60);

      // Section Title
      page.drawText(note.section.toUpperCase(), {
        x: margin,
        y,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 16;

      // Note Content
      const lines = this.wrapText(note.content, 85);
      for (const line of lines) {
        checkPageBreak(15);
        page.drawText(line, {
          x: margin,
          y,
          size: 9.5,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= 13;
      }

      // Key Points
      if (note.keyPoints && note.keyPoints.length > 0) {
        y -= 4;
        for (const pt of note.keyPoints) {
          checkPageBreak(15);
          const ptLines = this.wrapText(`• ${pt}`, 82);
          for (const l of ptLines) {
            page.drawText(l, {
              x: margin + 10,
              y,
              size: 9,
              font,
              color: rgb(0.2, 0.2, 0.2),
            });
            y -= 12;
          }
        }
      }

      // Sources
      if (note.sources && note.sources.length > 0) {
        y -= 4;
        checkPageBreak(14);
        const srcStr = `Sources: ${note.sources.map((s) => `${s.documentName} (p. ${s.pageNumber})`).join(', ')}`;
        page.drawText(srcStr, {
          x: margin,
          y,
          size: 8,
          font,
          color: rgb(0.45, 0.45, 0.45),
        });
        y -= 14;
      }

      y -= 16;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Generates a clean transcript PDF
   */
  async generateTranscriptPdf(
    documentName: string,
    turns: ExportTurnItem[],
    durationStr: string,
    summaryText?: string
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;
    const margin = 50;

    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < 50) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
    };

    page.drawText('LEARNSPHERE · ACADEMIC STUDY TRANSCRIPT', {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.12, 0.23, 0.54),
    });
    y -= 18;

    page.drawText('AI STUDY TRANSCRIPT', {
      x: margin,
      y,
      size: 18,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 16;

    page.drawText(`Document: ${documentName}  |  Duration: ${durationStr}  |  Date: ${new Date().toLocaleDateString()}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 25;

    // Turns
    for (const turn of turns) {
      checkPageBreak(50);
      const isUser = turn.speaker === 'user';
      const label = isUser ? `YOU [${turn.timestamp}]` : `AI TUTOR [${turn.timestamp}]`;
      const labelColor = isUser ? rgb(0.1, 0.1, 0.1) : rgb(0.12, 0.23, 0.54);

      page.drawText(label, {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: labelColor,
      });
      y -= 14;

      const lines = this.wrapText(turn.text, 85);
      for (const line of lines) {
        checkPageBreak(14);
        page.drawText(line, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= 12;
      }

      if (turn.sources && turn.sources.length > 0) {
        checkPageBreak(12);
        const srcStr = `Sources: ${turn.sources.map((s) => `${s.documentName} (p. ${s.pageNumber})`).join(', ')}`;
        page.drawText(srcStr, {
          x: margin,
          y,
          size: 7.5,
          font,
          color: rgb(0.45, 0.45, 0.45),
        });
        y -= 12;
      }

      y -= 14;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Appends newly generated study notes / transcript pages to the end of an existing PDF buffer.
   * NEVER alters or overwrites the original PDF.
   */
  async appendNotesToExistingPdf(
    originalPdfBuffer: Buffer,
    title: string,
    notes: ExportNoteItem[],
    summaryText?: string
  ): Promise<Buffer> {
    // Load existing PDF
    const baseDoc = await PDFDocument.load(originalPdfBuffer);
    const font = await baseDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await baseDoc.embedFont(StandardFonts.HelveticaBold);

    // Append new study notes pages
    let page = baseDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 50;
    const margin = 50;

    const checkPageBreak = (neededHeight: number) => {
      if (y - neededHeight < 50) {
        page = baseDoc.addPage([595.28, 841.89]);
        y = height - 50;
      }
    };

    // Append Separator Cover / Banner
    page.drawText('AI STUDY SESSION NOTES (APPENDED)', {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.12, 0.23, 0.54),
    });
    y -= 18;

    page.drawText(`Appended on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 25;

    for (const note of notes) {
      checkPageBreak(50);
      page.drawText(note.section.toUpperCase(), {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 14;

      const lines = this.wrapText(note.content, 85);
      for (const line of lines) {
        checkPageBreak(14);
        page.drawText(line, {
          x: margin,
          y,
          size: 9,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
        y -= 12;
      }

      if (note.sources && note.sources.length > 0) {
        checkPageBreak(12);
        const srcStr = `Sources: ${note.sources.map((s) => `${s.documentName} (p. ${s.pageNumber})`).join(', ')}`;
        page.drawText(srcStr, {
          x: margin,
          y,
          size: 7.5,
          font,
          color: rgb(0.45, 0.45, 0.45),
        });
        y -= 12;
      }

      y -= 12;
    }

    const mergedBytes = await baseDoc.save();
    return Buffer.from(mergedBytes);
  }

  private wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let curLine = '';

    for (const word of words) {
      if ((curLine + ' ' + word).trim().length <= maxCharsPerLine) {
        curLine = (curLine + ' ' + word).trim();
      } else {
        if (curLine) lines.push(curLine);
        curLine = word;
      }
    }
    if (curLine) lines.push(curLine);
    return lines.length > 0 ? lines : [''];
  }
}

export const pdfExportService = new PdfExportService();
