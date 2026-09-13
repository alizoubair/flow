import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Layers, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader, Circle } from 'lucide-react';
import { STAGE_ICON_MAP } from '../../../types/nodeTypes';
import { useRunStatus, toStageSlug } from '../../../contexts/RunStatusContext';
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

const RunBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'running')   return <Loader      size={13} className="stage-run-icon running" />;
  if (status === 'completed') return <CheckCircle2 size={13} className="stage-run-icon completed" />;
  if (status === 'failed')    return <XCircle      size={13} className="stage-run-icon failed" />;
  if (status === 'pending')   return <Circle       size={13} className="stage-run-icon pending" />;
  return null;
};

const StageNode: React.FC<NodeProps<StageNodeData>> = ({ data, selected }) => {
  const { stageStatuses } = useRunStatus();
  const slug = toStageSlug(data.label);
  const runStage = stageStatuses[slug];
  const runStatus = runStage?.status;

  const IconComponent = STAGE_ICON_MAP[data.stageType] || Layers;
  const stageName = data.stageName || 'Unnamed Stage';
  const isExpanded = data.isExpanded ?? true;
  const taskCount = data.taskCount || 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleExpand) data.onToggleExpand();
  };

  return (
    <div className={`stage-node ${selected ? 'selected' : ''} ${isExpanded ? 'expanded' : 'collapsed'} ${runStatus ? `run-${runStatus}` : ''}`}>
      <Handle type="target" position={Position.Top} className="stage-handle" />

      <div className="stage-node-content">
        <div className="stage-node-accent" style={{ background: data.color }} />

        <div className="stage-node-header">
          <div className="stage-node-icon" style={{ background: `${data.color}15`, color: data.color }}>
            <IconComponent size={20} />
          </div>

          <div className="stage-node-info">
            <div className="stage-node-type">{data.label}</div>
            <div className="stage-node-name">{stageName}</div>
          </div>

          {runStatus && (
            <div className="stage-run-badge">
              <RunBadge status={runStatus} />
            </div>
          )}

          {!runStatus && taskCount > 0 && (
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
