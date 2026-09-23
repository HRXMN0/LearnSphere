import React, { useState, useEffect } from 'react';
import { useLearning } from '../../context/LearningContext';
import { useApp } from '../../context/AppContext';
import { documentService } from '../../services/documentService';
import { CourseTopicMap, CourseTopicNode, ActiveConceptContext } from '../../types/document';
import { 
  Compass, 
  FileText, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  Layers, 
  Flame,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  CheckCircle2,
  Bookmark,
  FileQuestion,
  Lightbulb
} from 'lucide-react';

interface Props {
  onSelectConceptQuery?: (query: string) => void;
}

export const ContextPanel: React.FC<Props> = ({ onSelectConceptQuery }) => {
  const { 
    documents, 
    activeDocumentIds, 
    currentTopic, 
    askQuestion,
    activeConceptContext,
    setActiveConceptContext,
    clearActiveConceptContext
  } = useLearning();

  const { navigateTo, openDocumentStudy } = useApp();

  const activeDocs = documents.filter(d => activeDocumentIds.includes(d.id));

  // Multi-document focused document selection for Topic Map
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const focusedDocId = (selectedDocId && activeDocumentIds.includes(selectedDocId)) 
    ? selectedDocId 
    : (activeDocs[0]?.id || null);
  const focusedDoc = documents.find(d => d.id === focusedDocId);

  // Topic Map state
  const [topicMap, setTopicMap] = useState<CourseTopicMap | null>(null);
  const [loadingMap, setLoadingMap] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Collapsible hierarchy state
  const [expandedUnitIds, setExpandedUnitIds] = useState<Record<string, boolean>>({});
  const [expandedSectionIds, setExpandedSectionIds] = useState<Record<string, boolean>>({});

  // Fetch real Topic Map for focused document
  useEffect(() => {
    if (!focusedDocId) {
      setTopicMap(null);
      setLoadingMap(false);
      setMapError(null);
      return;
    }

    let isMounted = true;
    setLoadingMap(true);
    setMapError(null);

    documentService.getCourseTopicMap(focusedDocId)
      .then((map) => {
        if (!isMounted) return;
        setTopicMap(map);
        if (!map) {
          setMapError('Topic map unavailable');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to load topic map:', err);
        setMapError('Topic map unavailable');
        setTopicMap(null);
      })
      .finally(() => {
        if (isMounted) setLoadingMap(false);
      });

    return () => {
      isMounted = false;
    };
  }, [focusedDocId]);

  // Expand parent unit and section when an active concept is selected
  useEffect(() => {
    if (activeConceptContext && topicMap) {
      for (const unit of topicMap.tree) {
        for (const section of unit.children || []) {
          const match = (section.children || []).some(c => c.id === activeConceptContext.conceptId);
          if (match) {
            setExpandedUnitIds(prev => ({ ...prev, [unit.id]: true }));
            setExpandedSectionIds(prev => ({ ...prev, [section.id]: true }));
            return;
          }
        }
      }
    }
  }, [activeConceptContext, topicMap]);

  const toggleUnit = (unitId: string) => {
    setExpandedUnitIds(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSectionIds(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleSelectConcept = (unit: CourseTopicNode, section: CourseTopicNode, concept: CourseTopicNode) => {
    if (!focusedDoc) return;

    const newContext: ActiveConceptContext = {
      documentId: focusedDoc.id,
      documentName: focusedDoc.name,
      unitTitle: unit.title,
      sectionTitle: section.title,
      conceptId: concept.id,
      conceptTitle: concept.title,
      conceptDescription: concept.description,
      pageStart: concept.pageStart,
      pageEnd: concept.pageEnd,
      chunkIds: concept.chunkIds || [],
      keywords: concept.keywords || [],
    };

    setActiveConceptContext(newContext);
  };

  const handleAction = (actionType: 'summarize' | 'explain' | 'quiz' | 'exam') => {
    switch (actionType) {
      case 'summarize':
        if (activeConceptContext) {
          askQuestion(`Summarize the key concepts and principles of "${activeConceptContext.conceptTitle}" based on the selected learning material.`);
        } else {
          askQuestion(`Summarize the key concepts and principles of ${currentTopic} based on the selected learning material.`);
        }
        break;
      case 'explain':
        if (activeConceptContext) {
          askQuestion(`Explain "${activeConceptContext.conceptTitle}" simply with an intuitive analogy based on the selected material.`);
        } else {
          askQuestion(`Explain ${currentTopic} in simple terms with an intuitive analogy based on the selected material.`);
        }
        break;
      case 'quiz':
        navigateTo('quiz');
        break;
      case 'exam':
        if (activeConceptContext) {
          askQuestion(`What are the key technical concepts and potential exam questions for "${activeConceptContext.conceptTitle}"?`);
        } else {
          askQuestion(`What are the key technical concepts and potential exam questions for ${currentTopic}?`);
        }
        break;
      default:
        break;
    }
  };

  const handleConceptPrompt = (prompt: string) => {
    if (onSelectConceptQuery) {
      onSelectConceptQuery(prompt);
    } else {
      askQuestion(prompt);
    }
  };

  return (
    <aside className="w-80 flex-shrink-0 bg-white border-l border-[#E0DED7] flex flex-col h-full select-none overflow-y-auto">
      {/* Header */}
      <div className="p-3.5 border-b border-[#E0DED7] flex items-center justify-between">
        <h2 className="text-xs font-bold text-[#1F242E] font-serif-display flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#1E3A8A]" />
          Learning Context
        </h2>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F2F0E8] text-[#1F242E] border border-[#D4D2C9]">
          {activeDocs.length > 0 ? 'Active' : 'Standby'}
        </span>
      </div>

      <div className="p-3.5 space-y-4">
        {/* Current Topic / Concept Focus Capsule */}
        <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E0DED7] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
              {activeConceptContext ? 'Active Concept Scope' : 'Current Focus'}
            </span>
            {activeDocs.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[#1F242E] font-semibold bg-[#F2F0E8] px-1.5 py-0.5 rounded border border-[#D4D2C9] flex-shrink-0">
                <Flame className="w-2.5 h-2.5 text-amber-600" /> Grounded
              </span>
            )}
          </div>

          {activeConceptContext ? (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div>
                  <h3 className="text-xs font-bold text-[#1E3A8A] leading-tight">
                    {activeConceptContext.conceptTitle}
                  </h3>
                  <p className="text-[10px] text-[#5F6470] mt-0.5 line-clamp-1">
                    {activeConceptContext.unitTitle} &rsaquo; {activeConceptContext.sectionTitle}
                  </p>
                </div>
                {activeConceptContext.pageStart && (
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-50 text-[#1E3A8A] border border-blue-200 flex-shrink-0">
                    {activeConceptContext.pageEnd && activeConceptContext.pageEnd !== activeConceptContext.pageStart
                      ? `pp. ${activeConceptContext.pageStart}–${activeConceptContext.pageEnd}`
                      : `p. ${activeConceptContext.pageStart}`}
                  </span>
                )}
              </div>

              {/* Concept Quick Actions */}
              <div className="pt-1.5 border-t border-[#E0DED7]/80 flex flex-wrap gap-1">
                <button
                  onClick={() => handleConceptPrompt(`What is ${activeConceptContext.conceptTitle}?`)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-[#1F242E] border border-[#D4D2C9] hover:border-blue-300 transition-colors"
                >
                  What is this?
                </button>
                <button
                  onClick={() => handleConceptPrompt(`Explain ${activeConceptContext.conceptTitle} simply.`)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-[#1F242E] border border-[#D4D2C9] hover:border-blue-300 transition-colors"
                >
                  Explain simply
                </button>
                <button
                  onClick={() => handleConceptPrompt(`Why is ${activeConceptContext.conceptTitle} important?`)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-[#1F242E] border border-[#D4D2C9] hover:border-blue-300 transition-colors"
                >
                  Why it matters
                </button>
                <button
                  onClick={() => handleConceptPrompt(`Give me an example of ${activeConceptContext.conceptTitle}.`)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white hover:bg-blue-50 text-[#1F242E] border border-[#D4D2C9] hover:border-blue-300 transition-colors"
                >
                  Example
                </button>
              </div>

              {/* Clear Concept Context Button */}
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-[#5F6470] font-mono">
                  {activeConceptContext.chunkIds.length} concept chunks
                </span>
                <button
                  onClick={clearActiveConceptContext}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded border border-red-200 transition-colors"
                  title="Return Ask to document-level learning"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Clear topic context</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-[#1F242E] truncate" title={currentTopic}>
                {currentTopic}
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Hierarchical Topic Map Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
              Topic Map
            </span>
            {topicMap && (
              <span className="text-[10px] font-mono text-[#1E3A8A] font-medium">
                {topicMap.totalUnits} Units · {topicMap.totalSections} Sections · {topicMap.totalConcepts} Concepts
              </span>
            )}
          </div>

          {/* Multi-document switcher if multiple documents are selected */}
          {activeDocs.length > 1 && (
            <div className="p-2 rounded-lg bg-[#FAF9F5] border border-[#E0DED7] space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#5F6470]">
                <span>Showing Map for:</span>
                <span className="font-semibold text-[#1F242E] truncate max-w-[140px]" title={focusedDoc?.name}>
                  {focusedDoc?.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {activeDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors truncate max-w-[120px] ${
                      doc.id === focusedDocId
                        ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                        : 'bg-white text-[#1F242E] border-[#D4D2C9] hover:bg-[#F2F0E8]'
                    }`}
                  >
                    {doc.name.replace(/\.[^/.]+$/, '')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Topic Map Content Area */}
          {activeDocs.length === 0 ? (
            <p className="text-[11px] text-[#5F6470] italic p-2.5 bg-[#FAF9F5] rounded-xl border border-[#E0DED7]">
              Select a learning material to explore its Course Topic Map.
            </p>
          ) : loadingMap ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-[#5F6470] bg-[#FAF9F5] rounded-xl border border-[#E0DED7]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1E3A8A]" />
              <span>Loading topic map...</span>
            </div>
          ) : mapError || !topicMap || topicMap.tree.length === 0 ? (
            <div className="p-3 text-xs text-[#5F6470] bg-[#FAF9F5] rounded-xl border border-[#E0DED7] space-y-1">
              <p className="font-medium text-[#1F242E]">Topic map unavailable</p>
              <p className="text-[11px] leading-relaxed">
                Normal document-level Ask is active. Ask questions freely about the material.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-0.5">
              {topicMap.tree.map((unit) => {
                const isUnitExpanded = Boolean(expandedUnitIds[unit.id]);
                const sections = unit.children || [];

                return (
                  <div key={unit.id} className="rounded-xl border border-[#D4D2C9] bg-white overflow-hidden">
                    {/* Unit Row */}
                    <button
                      onClick={() => toggleUnit(unit.id)}
                      className="w-full flex items-center justify-between p-2 hover:bg-[#F2F0E8] transition-colors text-left"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        {isUnitExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#5F6470] flex-shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#1F242E] truncate" title={unit.title}>
                          {unit.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[#5F6470] flex-shrink-0">
                        {sections.length} sec
                      </span>
                    </button>

                    {/* Expanded Unit: Sections */}
                    {isUnitExpanded && (
                      <div className="border-t border-[#E0DED7] bg-[#FAF9F5] p-1.5 space-y-1">
                        {sections.map((section) => {
                          const isSectionExpanded = Boolean(expandedSectionIds[section.id]);
                          const concepts = section.children || [];

                          return (
                            <div key={section.id} className="rounded-lg border border-[#E0DED7] bg-white overflow-hidden">
                              {/* Section Row */}
                              <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[#F2F0E8] transition-colors text-left"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                  {isSectionExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-[#1E3A8A] flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-[#5F6470] flex-shrink-0" />
                                  )}
                                  <span className="text-[11px] font-medium text-[#1F242E] truncate" title={section.title}>
                                    {section.title}
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-[#5F6470] flex-shrink-0">
                                  {concepts.length} concepts
                                </span>
                              </button>

                              {/* Expanded Section: Concepts */}
                              {isSectionExpanded && (
                                <div className="border-t border-[#E0DED7] bg-[#FAF9F5] p-1 space-y-0.5">
                                  {concepts.map((concept) => {
                                    const isConceptSelected = activeConceptContext?.conceptId === concept.id;

                                    return (
                                      <button
                                        key={concept.id}
                                        onClick={() => handleSelectConcept(unit, section, concept)}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-all ${
                                          isConceptSelected
                                            ? 'bg-blue-50 border border-blue-300 text-[#1E3A8A] shadow-xs'
                                            : 'hover:bg-white text-[#1F242E] border border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                          {isConceptSelected ? (
                                            <CheckCircle2 className="w-3 h-3 text-[#1E3A8A] flex-shrink-0" />
                                          ) : (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[#5F6470] ml-1 flex-shrink-0" />
                                          )}
                                          <span className={`text-[11px] truncate ${isConceptSelected ? 'font-semibold text-[#1E3A8A]' : 'font-normal'}`} title={concept.title}>
                                            {concept.title}
                                          </span>
                                        </div>

                                        {concept.pageStart && (
                                          <span className={`text-[9px] font-mono px-1 py-0.2 rounded flex-shrink-0 ${
                                            isConceptSelected
                                              ? 'bg-blue-100 text-[#1E3A8A]'
                                              : 'text-[#5F6470]'
                                          }`}>
                                            {concept.pageEnd && concept.pageEnd !== concept.pageStart
                                              ? `pp. ${concept.pageStart}–${concept.pageEnd}`
                                              : `p. ${concept.pageStart}`}
                                          </span>
                                        )}
                                      </button>
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
              })}
            </div>
          )}
        </div>

        {/* Active Grounded Sources */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono">
              Active Sources ({activeDocs.length})
            </span>
            <span className="text-[10px] text-emerald-800 font-medium font-mono">
              {activeDocs.length > 0 ? 'Indexed' : 'None'}
            </span>
          </div>

          <div className="space-y-1.5">
            {activeDocs.length === 0 ? (
              <p className="text-[11px] text-[#5F6470] italic p-2.5 bg-[#FAF9F5] rounded-xl border border-[#E0DED7]">
                No active materials selected. Select a document in the library to activate RAG.
              </p>
            ) : (
              activeDocs.slice(0, 3).map((d) => (
                <div
                  key={d.id}
                  onClick={() => openDocumentStudy(d.id)}
                  className="p-2.5 rounded-xl bg-white hover:bg-[#F2F0E8] border border-[#D4D2C9] hover:border-[#BDB9AC] flex items-center justify-between text-xs cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#1E3A8A] flex-shrink-0" />
                    <span className="truncate text-[#1F242E] font-medium">{d.name}</span>
                  </div>
                  <span className="text-[10px] text-[#5F6470] font-mono group-hover:text-[#1F242E]">{d.pages}p</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Workspace Actions */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-[#5F6470] uppercase tracking-wider font-mono block">
            Workspace Actions
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            <button
              onClick={() => handleAction('summarize')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Summarize Material</span>
              </div>
              <ArrowRight className="w-3 h-3 text-[#5F6470]" />
            </button>

            <button
              onClick={() => handleAction('explain')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Explain Simply</span>
              </div>
              <ArrowRight className="w-3 h-3 text-[#5F6470]" />
            </button>

            <button
              onClick={() => handleAction('quiz')}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-xl bg-white hover:bg-[#F2F0E8] active:bg-[#E7E5DF] text-[#1F242E] border border-[#D4D2C9] hover:border-[#BDB9AC] transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#1F242E]/20"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Practice Quiz</span>
              </div>
              <ArrowRight className="w-3 h-3 text-[#5F6470]" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
