import React, { useState, useEffect, useMemo } from 'react';
import { useLearning } from '../../context/LearningContext';
import { 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Loader2,
  BookOpen,
  Search,
  ChevronRight,
  ChevronDown,
  Layers,
  FileText,
  Bookmark,
  Check,
  RotateCcw
} from 'lucide-react';
import { CapabilityBadge } from '../common/CapabilityBadge';
import { QuizConfiguration, QuizQuestion, QuizSubmission, QuizDifficulty, QuizQuestionType } from '../../types/quiz';
import { CourseTopicMap, CourseTopicNode } from '../../types/document';
import { quizService } from '../../services/quizService';
import { documentService } from '../../services/documentService';
import { QuizRunner } from './QuizRunner';
import { QuizResults } from './QuizResults';

// Helper to gather all chunk IDs from a node and its descendants
function gatherChunkIds(node: CourseTopicNode): string[] {
  let ids = [...(node.chunkIds || [])];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      ids = ids.concat(gatherChunkIds(child));
    }
  }
  return Array.from(new Set(ids));
}

// Count total concepts under a node
function countConcepts(node: CourseTopicNode): number {
  if (node.level === 'concept') return 1;
  if (!node.children || node.children.length === 0) return 0;
  return node.children.reduce((acc, child) => acc + countConcepts(child), 0);
}

export const QuizGeneratorView: React.FC = () => {
  const { documents, isDemoMode, refreshInsights } = useLearning();

  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [topicMap, setTopicMap] = useState<CourseTopicMap | null>(null);
  const [isLoadingTopicMap, setIsLoadingTopicMap] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<CourseTopicNode | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionType, setQuestionType] = useState<QuizQuestionType>('MCQ');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const [quizResults, setQuizResults] = useState<QuizSubmission | null>(null);

  // Sync selectedDocId when documents change
  useEffect(() => {
    if ((!selectedDocId || !documents.some(d => d.id === selectedDocId)) && documents.length > 0) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Load canonical Course Topic Map dynamically when selectedDocId changes
  useEffect(() => {
    if (!selectedDocId) {
      setTopicMap(null);
      setSelectedNode(null);
      return;
    }

    let isMounted = true;
    setIsLoadingTopicMap(true);
    setSelectedNode(null);
    setSearchFilter('');

    documentService.getCourseTopicMap(selectedDocId)
      .then((map) => {
        if (!isMounted) return;
        setTopicMap(map);
        if (map && map.tree && map.tree.length > 0) {
          // Expand first unit by default
          const initialExpanded = new Set<string>();
          map.tree.forEach((rn: CourseTopicNode) => initialExpanded.add(rn.id));
          setExpandedNodeIds(initialExpanded);
        }
      })
      .catch((err) => {
        console.warn('Failed to load topic map:', err);
        if (isMounted) setTopicMap(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingTopicMap(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDocId]);

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectNode = (node: CourseTopicNode | null) => {
    setSelectedNode(node);
  };

  // Filter tree nodes by search query
  const filteredNodes: CourseTopicNode[] = useMemo(() => {
    if (!topicMap?.tree) return [];
    if (!searchFilter.trim()) return topicMap.tree;

    const query = searchFilter.toLowerCase();

    function filterNode(node: CourseTopicNode): CourseTopicNode | null {
      const matchTitle = node.title.toLowerCase().includes(query);
      const matchDesc = node.description?.toLowerCase().includes(query);
      const matchKeywords = node.keywords?.some(k => k.toLowerCase().includes(query));

      const filteredChildren: CourseTopicNode[] = [];
      if (node.children) {
        for (const child of node.children) {
          const res = filterNode(child);
          if (res) filteredChildren.push(res);
        }
      }

      if (matchTitle || matchDesc || matchKeywords || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children
        };
      }
      return null;
    }

    return topicMap.tree
      .map((rn: CourseTopicNode) => filterNode(rn))
      .filter((rn: CourseTopicNode | null): rn is CourseTopicNode => rn !== null);
  }, [topicMap, searchFilter]);

  // Selected chunk IDs for the quiz
  const targetChunkIds = useMemo(() => {
    if (!selectedNode) return undefined;
    return gatherChunkIds(selectedNode);
  }, [selectedNode]);

  const selectedTopicTitle = useMemo(() => {
    if (!selectedNode) {
      const curDoc = documents.find(d => d.id === selectedDocId);
      return curDoc ? `Comprehensive Review: ${curDoc.name}` : 'Comprehensive Course Review';
    }
    return selectedNode.title;
  }, [selectedNode, documents, selectedDocId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const config: QuizConfiguration = {
        materialId: selectedDocId,
        topic: selectedTopicTitle,
        conceptId: selectedNode?.id,
        chunkIds: targetChunkIds && targetChunkIds.length > 0 ? targetChunkIds : undefined,
        difficulty,
        questionCount,
        questionType
      };
      const questions = await quizService.generateQuiz(config, isDemoMode);
      setActiveQuizQuestions(questions);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || 'Failed to generate quiz. Please ensure documents are uploaded and indexed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetake = () => {
    setQuizResults(null);
  };

  const handleNewQuiz = () => {
    setActiveQuizQuestions(null);
    setQuizResults(null);
  };

  // If viewing results
  if (quizResults) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5]">
        <QuizResults
          results={quizResults}
          onRetakeQuiz={handleRetake}
          onNewQuiz={handleNewQuiz}
        />
      </div>
    );
  }

  // If taking quiz
  if (activeQuizQuestions) {
    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5]">
        <QuizRunner
          questions={activeQuizQuestions}
          documentId={selectedDocId}
          topic={selectedNode?.title || (topicMap ? topicMap.courseTitle : 'General Practice')}
          onFinish={(res) => {
            setQuizResults(res);
            refreshInsights();
          }}
          onCancel={handleNewQuiz}
        />
      </div>
    );
  }

  const currentDoc = documents.find(d => d.id === selectedDocId);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAF9F5] select-none">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Editorial Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#E7E5DF]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-lg bg-amber-50 text-amber-700">
                <HelpCircle className="w-4 h-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif-display text-[#1A1A18] tracking-tight">
                Practice
              </h1>
              <CapabilityBadge capability="GENERATIVE AI" size="sm" />
            </div>
            <p className="text-xs sm:text-sm text-[#7A7973]">
              Generate grounded practice quizzes targeted to specific chapters, sections, or concepts in your course.
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 leading-relaxed">
            <span className="font-semibold block mb-0.5">Quiz Generation Notice:</span>
            {errorMessage}
          </div>
        )}

        {/* Examination Configuration Card */}
        <div className="bg-white rounded-2xl border border-[#E7E5DF] p-6 sm:p-8 shadow-soft space-y-6">
          {/* Field 1: Source Material Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
              Study Material Source
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-[#FAF9F5] border border-[#E7E5DF] rounded-xl focus:outline-none focus:bg-white focus:border-cobalt-500 text-[#1A1A18] font-medium"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.pages} pages)
                </option>
              ))}
            </select>
          </div>

          {/* Field 2: Hierarchical Course Topic Map Tree */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-[#7A7973] uppercase tracking-wider font-mono block">
                Target Curriculum Scope
              </label>
              {topicMap && (
                <span className="text-[11px] text-[#7A7973] font-mono">
                  {topicMap.totalUnits} Units · {topicMap.totalConcepts} Concepts
                </span>
              )}
            </div>

            {/* Tree Container */}
            <div className="border border-[#E7E5DF] rounded-xl bg-[#FAF9F5] overflow-hidden">
              {/* Search Bar */}
              <div className="p-2.5 bg-white border-b border-[#E7E5DF] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#7A7973] shrink-0" />
                <input
                  type="text"
                  placeholder="Search concepts, signals, transmission, protocols..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-transparent text-xs text-[#1A1A18] placeholder-[#9E9D98] focus:outline-none"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="text-[10px] text-[#7A7973] hover:text-[#1A1A18] px-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Entire Document Selection Option */}
              <div
                onClick={() => handleSelectNode(null)}
                className={`p-3 border-b border-[#E7E5DF] flex items-center justify-between cursor-pointer transition-colors ${
                  selectedNode === null
                    ? 'bg-amber-50/80 border-l-4 border-l-amber-600'
                    : 'hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 rounded-md ${selectedNode === null ? 'bg-amber-600 text-white' : 'bg-[#E7E5DF] text-[#7A7973]'}`}>
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#1A1A18]">
                      Comprehensive Document Review
                    </div>
                    <div className="text-[11px] text-[#7A7973]">
                      Entire document ({currentDoc?.pages || 0} pages · all concepts)
                    </div>
                  </div>
                </div>
                {selectedNode === null && (
                  <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Selected
                  </span>
                )}
              </div>

              {/* Hierarchy Tree Area */}
              <div className="max-h-72 overflow-y-auto p-2 space-y-1 divide-y divide-[#F0EFEA]">
                {isLoadingTopicMap ? (
                  <div className="py-8 text-center space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-700" />
                    <p className="text-xs text-[#7A7973]">Analyzing document curriculum & hierarchy...</p>
                  </div>
                ) : filteredNodes.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#7A7973]">
                    {searchFilter ? 'No concepts matching your search filter.' : 'No topic hierarchy available.'}
                  </div>
                ) : (
                  filteredNodes.map((unit: CourseTopicNode) => {
                    const isUnitExpanded = expandedNodeIds.has(unit.id) || Boolean(searchFilter);
                    const isUnitSelected = selectedNode?.id === unit.id;
                    const unitConceptCount = countConcepts(unit);

                    return (
                      <div key={unit.id} className="pt-1.5 first:pt-0">
                        {/* Unit Row */}
                        <div
                          onClick={() => handleSelectNode(unit)}
                          className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isUnitSelected ? 'bg-amber-50 border border-amber-300' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(unit.id, e)}
                              className="p-1 hover:bg-black/5 rounded text-[#7A7973] hover:text-[#1A1A18] transition-colors"
                            >
                              {isUnitExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <Bookmark className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <div className="truncate">
                              <span className="text-xs font-bold text-[#1A1A18]">{unit.title}</span>
                              {unit.pageStart && (
                                <span className="ml-2 text-[10px] text-[#7A7973] font-mono">
                                  pp. {unit.pageStart}{unit.pageEnd && unit.pageEnd !== unit.pageStart ? `–${unit.pageEnd}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-[#7A7973] bg-[#EAE8E1] px-1.5 py-0.5 rounded font-mono">
                              {unitConceptCount} {unitConceptCount === 1 ? 'concept' : 'concepts'}
                            </span>
                            {isUnitSelected && <Check className="w-3 h-3 text-amber-700" />}
                          </div>
                        </div>

                        {/* Sections & Concepts inside Unit */}
                        {isUnitExpanded && unit.children && (
                          <div className="ml-5 pl-2 border-l border-[#E2DFD6] space-y-1 my-1">
                            {unit.children.map((section: CourseTopicNode) => {
                              const isSectionExpanded = expandedNodeIds.has(section.id) || Boolean(searchFilter);
                              const isSectionSelected = selectedNode?.id === section.id;
                              const sectionConceptCount = countConcepts(section);

                              return (
                                <div key={section.id}>
                                  {/* Section Row */}
                                  <div
                                    onClick={() => handleSelectNode(section)}
                                    className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors ${
                                      isSectionSelected ? 'bg-amber-50 border border-amber-300' : 'hover:bg-white'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {section.children && section.children.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={(e) => toggleExpand(section.id, e)}
                                          className="p-0.5 hover:bg-black/5 rounded text-[#7A7973] hover:text-[#1A1A18]"
                                        >
                                          {isSectionExpanded ? (
                                            <ChevronDown className="w-3 h-3" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3" />
                                          )}
                                        </button>
                                      ) : (
                                        <span className="w-3 h-3 inline-block" />
                                      )}
                                      <span className="text-xs font-semibold text-[#2D2C28] truncate">
                                        {section.title}
                                      </span>
                                      {section.pageStart && (
                                        <span className="text-[10px] text-[#7A7973] font-mono">
                                          p. {section.pageStart}{section.pageEnd && section.pageEnd !== section.pageStart ? `–${section.pageEnd}` : ''}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {sectionConceptCount > 0 && (
                                        <span className="text-[10px] text-[#7A7973] bg-[#EAE8E1] px-1 py-0.2 rounded font-mono">
                                          {sectionConceptCount}
                                        </span>
                                      )}
                                      {isSectionSelected && <Check className="w-3 h-3 text-amber-700" />}
                                    </div>
                                  </div>

                                  {/* Concept Leaf Rows */}
                                  {isSectionExpanded && section.children && (
                                    <div className="ml-5 pl-2 border-l border-[#E7E5DF] space-y-0.5 my-1">
                                      {section.children.map((concept: CourseTopicNode) => {
                                        const isConceptSelected = selectedNode?.id === concept.id;
                                        return (
                                          <div
                                            key={concept.id}
                                            onClick={() => handleSelectNode(concept)}
                                            className={`flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors text-xs ${
                                              isConceptSelected
                                                ? 'bg-amber-100 text-amber-950 font-medium'
                                                : 'text-[#44423E] hover:bg-white hover:text-[#1A1A18]'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConceptSelected ? 'bg-amber-600' : 'bg-[#AFAEA8]'}`} />
                                              <span className="truncate">{concept.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              {concept.pageStart ? (
                                                <span className="text-[10px] text-amber-900/70 font-mono bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200/60">
                                                  Pages {concept.pageStart}{concept.pageEnd && concept.pageEnd !== concept.pageStart ? `–${concept.pageEnd}` : ''}
                                                </span>
                                              ) : null}
                                              {isConceptSelected && <Check className="w-3 h-3 text-amber-700" />}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected Scope Indicator */}
            <div className="p-2.5 bg-[#FAF9F5] border border-[#E7E5DF] rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  CURRENT SCOPE
                </span>
                <span className="font-semibold text-[#1A1A18] truncate">
                  {selectedTopicTitle}
                </span>
                {selectedNode && (
                  <span className="text-[11px] text-[#7A7973] shrink-0">
                    ({selectedNode.level.toUpperCase()} · {targetChunkIds?.length || 0} chunks)
                  </span>
                )}
              </div>
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-[11px] text-amber-800 hover:text-amber-950 font-medium shrink-0 ml-2"
                >
                  Reset to All
                </button>
              )}
            </div>
          </div>

          {/* Difficulty & Count Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-[#E7E5DF]">
            {/* Field 3: Difficulty */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono block">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Easy', 'Medium', 'Hard'] as QuizDifficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors duration-150 ${
                      difficulty === level
                        ? 'bg-[#1F242E] border-[#161B22] text-white shadow-xs'
                        : 'bg-white border-[#D4D2C9] text-[#1F242E] hover:bg-[#F2F0E8]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Field 4: Question Count */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono block">
                Number of Questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[5, 10, 20].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`py-2 rounded-lg text-xs font-semibold border transition-colors duration-150 ${
                      questionCount === count
                        ? 'bg-[#1F242E] border-[#161B22] text-white shadow-xs'
                        : 'bg-white border-[#D4D2C9] text-[#1F242E] hover:bg-[#F2F0E8]'
                    }`}
                  >
                    {count} Questions
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assessment Format */}
          <div className="space-y-1.5 pt-2 border-t border-[#E7E5DF]">
            <label className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono block">
              Assessment Format
            </label>
            <div className="flex flex-wrap gap-2.5">
              {(['MCQ', 'True/False', 'Short Answer'] as QuizQuestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setQuestionType(type)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors duration-150 ${
                    questionType === type
                      ? 'bg-[#1F242E] border-[#161B22] text-white shadow-xs'
                      : 'bg-white border-[#D4D2C9] text-[#1F242E] hover:bg-[#F2F0E8]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Generate CTA (PRIMARY ACTION) */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#E7E5DF]">
            <span className="text-xs text-[#5F6470]">
              Strictly grounded on the selected concepts and source chunks in Azure AI Search.
            </span>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || documents.length === 0}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#1F242E] hover:bg-[#2E3545] active:bg-[#161B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg border border-[#161B22] shadow-sm transition-colors duration-150 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Synthesizing Quiz...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Generate Practice Quiz</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
