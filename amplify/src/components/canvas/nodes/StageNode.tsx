import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Layers,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { STAGE_ICON_MAP } from '../../../types/nodeTypes';
import './StageNode.css';

interface StageNodeData {
  label: string;
  stageType: string;
  stageName?: string;
  color: string;
  tasks?: any[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  taskCount?: number;
}

const StageNode: React.FC<NodeProps<StageNodeData>> = ({ data, selected }) => {
  const IconComponent = STAGE_ICON_MAP[data.stageType] || Layers;
  const stageName = data.stageName || 'Unnamed Stage';
  const isExpanded = data.isExpanded ?? true;
  const taskCount = data.taskCount || 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleExpand) {
      data.onToggleExpand();
    }
  };

  return (
    <div className={`stage-node ${selected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <Handle type="target" position={Position.Top} className="stage-handle" />

      <div className="stage-node-content">
        <div
          className="stage-node-accent"
          style={{ background: data.color }}
        />

        <div className="stage-node-header">
          <div
            className="stage-node-icon"
            style={{
              background: `${data.color}15`,
              color: data.color
            }}
          >
            <IconComponent size={20} />
          </div>

          <div className="stage-node-info">
            <div className="stage-node-type">{data.label}</div>
            <div className="stage-node-name">{stageName}</div>
          </div>

          {taskCount > 0 && (
            <button className="stage-toggle-btn" onClick={handleToggle}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="stage-handle" />
    </div>
  );
};

export default StageNode;
