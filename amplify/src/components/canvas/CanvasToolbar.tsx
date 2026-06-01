import React from 'react';
import { Layers, Workflow, MousePointer2, Hand, Trash2, Minus, MoreHorizontal, Activity, Spline } from 'lucide-react';
import { EdgeStyle } from '../../store/pipelineStore';
import './CanvasToolbar.css';

export type CanvasMode = 'select' | 'hand';

interface CanvasToolbarProps {
  mode: CanvasMode;
  componentsOpen: boolean;
  agentOpen: boolean;
  hasSelection: boolean;
  edgeStyle: EdgeStyle;
  onModeChange: (mode: CanvasMode) => void;
  onDelete: () => void;
  onToggleComponents: () => void;
  onToggleAgent: () => void;
  onEdgeStyleChange: (style: EdgeStyle) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  mode,
  componentsOpen,
  agentOpen,
  hasSelection,
  edgeStyle,
  onModeChange,
  onDelete,
  onToggleComponents,
  onToggleAgent,
  onEdgeStyleChange,
}) => {
  return (
    <div className="canvas-toolbar">
      {/* Interaction mode */}
      <button
        className={`canvas-toolbar-btn icon-only ${mode === 'select' ? 'active' : ''}`}
        onClick={() => onModeChange('select')}
        aria-label="Select mode"
        title="Select (V)"
      >
        <MousePointer2 size={16} />
      </button>
      <button
        className={`canvas-toolbar-btn icon-only ${mode === 'hand' ? 'active' : ''}`}
        onClick={() => onModeChange('hand')}
        aria-label="Hand mode"
        title="Hand (H)"
      >
        <Hand size={16} />
      </button>

      <div className="canvas-toolbar-divider" />

      {/* Delete selected */}
      <button
        className={`canvas-toolbar-btn icon-only ${hasSelection ? '' : ''}`}
        onClick={onDelete}
        disabled={!hasSelection}
        aria-label="Delete selected"
        title="Delete selected (Del)"
      >
        <Trash2 size={16} />
      </button>

      <div className="canvas-toolbar-divider" />

      {/* Edge style */}
      <button
        className={`canvas-toolbar-btn icon-only ${edgeStyle === 'solid' ? 'active' : ''}`}
        onClick={() => onEdgeStyleChange('solid')}
        aria-label="Solid edge"
        title="Solid connection"
      >
        <Minus size={16} />
      </button>
      <button
        className={`canvas-toolbar-btn icon-only ${edgeStyle === 'smoothstep' ? 'active' : ''}`}
        onClick={() => onEdgeStyleChange('smoothstep')}
        aria-label="Smooth edge"
        title="Smooth connection"
      >
        <Spline size={16} />
      </button>
      <button
        className={`canvas-toolbar-btn icon-only ${edgeStyle === 'dashed' ? 'active' : ''}`}
        onClick={() => onEdgeStyleChange('dashed')}
        aria-label="Dashed edge"
        title="Dashed connection"
      >
        <MoreHorizontal size={16} />
      </button>
      <button
        className={`canvas-toolbar-btn icon-only ${edgeStyle === 'animated' ? 'active' : ''}`}
        onClick={() => onEdgeStyleChange('animated')}
        aria-label="Animated edge"
        title="Animated connection"
      >
        <Activity size={16} />
      </button>

      <div className="canvas-toolbar-divider" />

      {/* Panel toggles */}
      <button
        className={`canvas-toolbar-btn icon-only ${componentsOpen ? 'active' : ''}`}
        onClick={onToggleComponents}
        aria-label="Toggle Components panel"
        title="Components"
      >
        <Layers size={16} />
      </button>
      <button
        className={`canvas-toolbar-btn icon-only ${agentOpen ? 'active' : ''}`}
        onClick={onToggleAgent}
        aria-label="Toggle Pipeline Agent"
        title="Pipeline Agent"
      >
        <Workflow size={16} />
      </button>
    </div>
  );
};

export default CanvasToolbar;
