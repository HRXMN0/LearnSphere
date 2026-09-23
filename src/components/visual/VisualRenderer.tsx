import React, { useState, useRef } from 'react';
import { VisualSpec, FlowchartSpec, MindMapSpec, DiagramSpec } from '../../types/visual';
import { ZoomIn, ZoomOut, RotateCcw, Download, ShieldCheck, Sparkles, Layers } from 'lucide-react';

interface VisualRendererProps {
  spec: VisualSpec;
  className?: string;
}

export const VisualRenderer: React.FC<VisualRendererProps> = ({ spec, className = '' }) => {
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'visual'}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };

  const renderContent = () => {
    switch (spec.type) {
      case 'flowchart':
        return renderFlowchart(spec as FlowchartSpec);
      case 'mindmap':
        return renderMindMap(spec as MindMapSpec);
      case 'diagram':
        return renderDiagram(spec as DiagramSpec);
      default:
        return null;
    }
  };

  return (
    <div className={`rounded-xl border border-border/80 bg-surface-lowest/70 backdrop-blur-md overflow-hidden flex flex-col ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-border/60 bg-surface-low/50 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-text-primary tracking-tight">{spec.title}</h4>
            {spec.groundingSource && (
              <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                Grounded in: <span className="text-text-secondary font-medium">{spec.groundingSource.documentName}</span>
                {spec.groundingSource.page && <span> · Page {spec.groundingSource.page}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="p-1.5 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors border border-border/40"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-text-muted px-1 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
            className="p-1.5 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors border border-border/40"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-md hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors border border-border/40"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownloadSVG}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-surface-elevated hover:bg-surface-high text-text-primary border border-border/60 transition-colors ml-1 font-medium shadow-xs"
            title="Export as SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-auto p-4 flex items-center justify-center min-h-[360px] max-h-[640px] bg-dots-pattern">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="flex items-center justify-center"
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // FLOWCHART RENDERER
  // -------------------------------------------------------------
  function renderFlowchart(flow: FlowchartSpec) {
    const nodes = flow.nodes || [];
    const edges = flow.edges || [];

    if (nodes.length === 0) {
      return (
        <div className="text-center py-8 text-text-muted text-sm">
          No flowchart nodes specified.
        </div>
      );
    }

    const nodeWidth = 260;
    const nodeHeight = 64;
    const verticalGap = 55;
    const totalHeight = nodes.length * nodeHeight + (nodes.length - 1) * verticalGap + 80;
    const totalWidth = nodeWidth + 160;
    const centerX = totalWidth / 2;

    // Calculate node coordinates vertically
    const nodePositions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node, index) => {
      const y = 40 + index * (nodeHeight + verticalGap);
      nodePositions[node.id] = { x: centerX, y };
    });

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className="select-none font-sans drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="flow-start" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="flow-proc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="flow-end" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => {
          const fromPos = nodePositions[edge.from];
          const toPos = nodePositions[edge.to];
          if (!fromPos || !toPos) return null;

          const startY = fromPos.y + nodeHeight / 2;
          const endY = toPos.y - nodeHeight / 2;
          const midY = (startY + endY) / 2;

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={fromPos.x}
                y1={startY}
                x2={toPos.x}
                y2={endY}
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray={edge.label ? '4 2' : 'none'}
                markerEnd="url(#arrow)"
              />
              {edge.label && (
                <g>
                  <rect
                    x={centerX - (edge.label.length * 4.5) - 8}
                    y={midY - 11}
                    width={edge.label.length * 9 + 16}
                    height={20}
                    rx="4"
                    fill="#1e293b"
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  <text
                    x={centerX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="11"
                    fontWeight="500"
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const isStart = idx === 0 || node.type === 'start';
          const isEnd = idx === nodes.length - 1 || node.type === 'end';
          const isDecision = node.type === 'decision';

          const strokeColor = isStart ? '#60a5fa' : isEnd ? '#34d399' : isDecision ? '#f59e0b' : '#334155';
          const fillColor = isStart ? '#1e3a8a' : isEnd ? '#064e3b' : isDecision ? '#78350f' : '#1e293b';

          return (
            <g key={node.id} transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}>
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx={isStart || isEnd ? 32 : isDecision ? 8 : 12}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1.75"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />
              <text
                x={nodeWidth / 2}
                y={node.detail ? 28 : 36}
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="13"
                fontWeight="600"
              >
                {node.label.length > 34 ? `${node.label.slice(0, 32)}...` : node.label}
              </text>
              {node.detail && (
                <text
                  x={nodeWidth / 2}
                  y={48}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10.5"
                  fontWeight="400"
                >
                  {node.detail.length > 38 ? `${node.detail.slice(0, 36)}...` : node.detail}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }

  // -------------------------------------------------------------
  // MIND MAP RENDERER
  // -------------------------------------------------------------
  function renderMindMap(mindMap: MindMapSpec) {
    const branches = mindMap.branches || [];
    if (branches.length === 0) {
      return (
        <div className="text-center py-8 text-text-muted text-sm">
          No mind map branches specified.
        </div>
      );
    }

    const rootX = 140;
    const branchX = 360;
    const childX = 600;

    // Calculate vertical layout
    let currentY = 50;
    const branchLayouts: Array<{
      branch: (typeof branches)[0];
      y: number;
      childrenWithY: Array<{ text: string; y: number }>;
    }> = [];

    branches.forEach((branch) => {
      const children = branch.children || [];
      const childCount = Math.max(1, children.length);
      const branchStartY = currentY;

      const childrenWithY: Array<{ text: string; y: number }> = [];
      children.forEach((child, cIdx) => {
        const text = typeof child === 'string' ? child : child.label;
        childrenWithY.push({ text, y: branchStartY + cIdx * 42 });
      });

      const branchMidY = branchStartY + ((childCount - 1) * 42) / 2;
      branchLayouts.push({ branch, y: branchMidY, childrenWithY });

      currentY += childCount * 42 + 30;
    });

    const totalHeight = Math.max(380, currentY + 40);
    const totalWidth = 840;
    const rootY = totalHeight / 2;

    const branchColors = ['#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24'];

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className="select-none font-sans"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="root-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* Branch Curves from Root */}
        {branchLayouts.map((bl, bIdx) => {
          const color = branchColors[bIdx % branchColors.length];
          const pathD = `M ${rootX + 75} ${rootY} C ${(rootX + branchX) / 2} ${rootY}, ${(rootX + branchX) / 2} ${bl.y}, ${branchX - 8} ${bl.y}`;

          return (
            <g key={`branch-conn-${bIdx}`}>
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeOpacity="0.75"
              />

              {/* Sub-branch curves to children */}
              {bl.childrenWithY.map((c, cIdx) => {
                const childPathD = `M ${branchX + 115} ${bl.y} C ${(branchX + childX) / 2} ${bl.y}, ${(branchX + childX) / 2} ${c.y}, ${childX - 6} ${c.y}`;
                return (
                  <path
                    key={`child-conn-${cIdx}`}
                    d={childPathD}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeOpacity="0.5"
                    strokeDasharray="3 3"
                  />
                );
              })}
            </g>
          );
        })}

        {/* Root Node */}
        <g transform={`translate(${rootX - 75}, ${rootY - 26})`}>
          <rect
            width="150"
            height="52"
            rx="14"
            fill="url(#root-grad)"
            stroke="#93c5fd"
            strokeWidth="2"
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))"
          />
          <text
            x="75"
            y="31"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="14"
            fontWeight="bold"
            letterSpacing="0.02em"
          >
            {mindMap.root.length > 18 ? `${mindMap.root.slice(0, 16)}...` : mindMap.root}
          </text>
        </g>

        {/* Primary Branches */}
        {branchLayouts.map((bl, bIdx) => {
          const color = branchColors[bIdx % branchColors.length];
          return (
            <g key={`branch-${bIdx}`} transform={`translate(${branchX - 10}, ${bl.y - 18})`}>
              <rect
                width="135"
                height="36"
                rx="8"
                fill="#1e293b"
                stroke={color}
                strokeWidth="2"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />
              <text
                x="67.5"
                y="22"
                textAnchor="middle"
                fill="#f1f5f9"
                fontSize="12"
                fontWeight="600"
              >
                {bl.branch.label.length > 18 ? `${bl.branch.label.slice(0, 16)}...` : bl.branch.label}
              </text>
            </g>
          );
        })}

        {/* Leaf Children */}
        {branchLayouts.map((bl) =>
          bl.childrenWithY.map((child, cIdx) => (
            <g key={`leaf-${cIdx}`} transform={`translate(${childX}, ${child.y - 14})`}>
              <rect
                width="180"
                height="28"
                rx="6"
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="1.25"
              />
              <circle cx="10" cy="14" r="3" fill="#38bdf8" />
              <text
                x="20"
                y="18"
                fill="#cbd5e1"
                fontSize="11"
                fontWeight="500"
              >
                {child.text.length > 24 ? `${child.text.slice(0, 22)}...` : child.text}
              </text>
            </g>
          ))
        )}
      </svg>
    );
  }

  // -------------------------------------------------------------
  // DIAGRAM RENDERER (System / Components / Relations)
  // -------------------------------------------------------------
  function renderDiagram(diagram: DiagramSpec) {
    const components = diagram.components || [];
    const connections = diagram.connections || [];

    if (components.length === 0) {
      return (
        <div className="text-center py-8 text-text-muted text-sm">
          No diagram components specified.
        </div>
      );
    }

    const cardWidth = 200;
    const cardHeight = 70;
    const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(components.length))));
    const gapX = 80;
    const gapY = 70;

    const compPositions: Record<string, { x: number; y: number }> = {};
    components.forEach((comp, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 50 + col * (cardWidth + gapX);
      const y = 40 + row * (cardHeight + gapY);
      compPositions[comp.id] = { x, y };
    });

    const totalWidth = cols * cardWidth + (cols - 1) * gapX + 100;
    const rows = Math.ceil(components.length / cols);
    const totalHeight = rows * cardHeight + (rows - 1) * gapY + 100;

    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className="select-none font-sans"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="diag-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Connections */}
        {connections.map((conn, idx) => {
          const from = compPositions[conn.from];
          const to = compPositions[conn.to];
          if (!from || !to) return null;

          const fromCenter = { x: from.x + cardWidth / 2, y: from.y + cardHeight / 2 };
          const toCenter = { x: to.x + cardWidth / 2, y: to.y + cardHeight / 2 };
          const mid = { x: (fromCenter.x + toCenter.x) / 2, y: (fromCenter.y + toCenter.y) / 2 };

          return (
            <g key={`conn-${idx}`}>
              <line
                x1={fromCenter.x}
                y1={fromCenter.y}
                x2={toCenter.x}
                y2={toCenter.y}
                stroke="#38bdf8"
                strokeWidth="1.75"
                strokeDasharray="4 2"
                markerEnd="url(#diag-arrow)"
              />
              {conn.relationship && (
                <g>
                  <rect
                    x={mid.x - (conn.relationship.length * 4) - 6}
                    y={mid.y - 10}
                    width={conn.relationship.length * 8 + 12}
                    height={18}
                    rx="4"
                    fill="#0f172a"
                    stroke="#0284c7"
                    strokeWidth="1"
                  />
                  <text
                    x={mid.x}
                    y={mid.y + 3}
                    textAnchor="middle"
                    fill="#7dd3fc"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {conn.relationship}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Component Cards */}
        {components.map((comp) => {
          const pos = compPositions[comp.id];
          if (!pos) return null;

          return (
            <g key={comp.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={cardWidth}
                height={cardHeight}
                rx="10"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
              />
              <g transform="translate(12, 14)">
                <Layers className="w-3.5 h-3.5 text-primary inline" />
              </g>
              <text
                x="32"
                y="26"
                fill="#f8fafc"
                fontSize="13"
                fontWeight="600"
              >
                {comp.label.length > 22 ? `${comp.label.slice(0, 20)}...` : comp.label}
              </text>
              {comp.role && (
                <text
                  x="14"
                  y="48"
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="400"
                >
                  {comp.role.length > 26 ? `${comp.role.slice(0, 24)}...` : comp.role}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }
};
