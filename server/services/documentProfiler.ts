import { azureOpenAI } from './azureOpenAIService';
import { ParsedDocumentResult } from './documentParser';
import { DocumentChunk } from './chunker';
import { courseTopicMapService } from './courseTopicMapService';
import { config } from '../config';

export interface DocumentTopic {
  id: string;
  name: string;
  description: string;
  sourcePages?: number[];
}

export interface DocumentProfile {
  documentId: string;
  documentName: string;
  title: string;
  subject: string;
  mainTopic: string;
  topics: DocumentTopic[];
  keyConcepts: string[];
  suggestedQuestions: string[];
}

/**
 * Extracts a dynamic educational profile grounded in the canonical Course Topic Map.
 */
export async function generateDocumentProfile(
  documentId: string,
  documentName: string,
  parsed: ParsedDocumentResult,
  chunks: DocumentChunk[]
): Promise<DocumentProfile> {
  try {
    const topicMap = await courseTopicMapService.getTopicMap(
      documentId,
      documentName,
      parsed.totalPages,
      chunks
    );

    // Convert CourseTopicMap nodes (sections and concepts) into DocumentTopic format
    const docTopics: DocumentTopic[] = topicMap.nodes
      .filter((n) => n.level === 'concept' || n.level === 'section')
      .map((n) => ({
        id: n.id,
        name: n.title,
        description: n.description || `Instructional material on ${n.title}`,
        sourcePages: n.pageStart ? [n.pageStart, n.pageEnd || n.pageStart] : [1],
      }));

    // Extract all concept titles as keyConcepts
    const concepts = topicMap.nodes.filter((n) => n.level === 'concept');
    const keyConcepts = concepts.map((c) => c.title);

    // Generate grounded study questions based on the real units
    const suggestedQuestions: string[] = topicMap.tree.slice(0, 4).map((u) => {
      return `Explain the core concepts and mechanisms of ${u.title} in ${topicMap.courseTitle}.`;
    });

    if (suggestedQuestions.length === 0) {
      suggestedQuestions.push(`Explain the primary principles introduced in ${topicMap.courseTitle}.`);
    }

    return {
      documentId,
      documentName,
      title: topicMap.courseTitle,
      subject: 'Academic Course Material',
      mainTopic: topicMap.courseTitle,
      topics: docTopics.length > 0 ? docTopics : generateDefaultTopics(documentName, parsed),
      keyConcepts: keyConcepts.length > 0 ? keyConcepts : ['Core Concepts', 'Overview'],
      suggestedQuestions,
    };
  } catch (err) {
    console.warn(`[Profiler] Could not generate dynamic profile for ${documentName}, using heuristic fallback:`, err);
    return generateHeuristicProfile(documentId, documentName, parsed);
  }
}

/**
 * Deterministic heuristic fallback if LLM extraction is unavailable
 */
function generateHeuristicProfile(
  documentId: string,
  documentName: string,
  parsed: ParsedDocumentResult
): DocumentProfile {
  const cleanName = documentName.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[\.\s\-_]*/, '');
  return {
    documentId,
    documentName,
    title: cleanName,
    subject: 'Academic Study Material',
    mainTopic: cleanName,
    topics: generateDefaultTopics(documentName, parsed),
    keyConcepts: [cleanName, 'Overview', 'Key Principles', 'Analysis'],
    suggestedQuestions: [
      `What are the primary concepts covered in ${cleanName}?`,
      `Explain the key principles introduced in ${cleanName}.`,
      `Summarize the main takeaways from ${cleanName}.`
    ],
  };
}

function generateDefaultTopics(documentName: string, parsed: ParsedDocumentResult): DocumentTopic[] {
  const cleanName = documentName.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[\.\s\-_]*/, '');
  return [
    {
      id: 't1',
      name: `${cleanName} — Fundamentals & Overview`,
      description: `Foundational definitions and core concepts introduced in ${cleanName}.`,
      sourcePages: [1, 2],
    },
    {
      id: 't2',
      name: `${cleanName} — Architecture & Mechanics`,
      description: `Structural components, workflows, and specifications discussed in the document.`,
      sourcePages: [Math.min(3, parsed.totalPages)],
    },
    {
      id: 't3',
      name: `${cleanName} — Analysis & Practical Applications`,
      description: `Practical implementations, comparisons, and evaluation criteria.`,
      sourcePages: [parsed.totalPages],
    },
  ];
}
