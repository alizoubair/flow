import React from 'react';
import { NodeProps } from 'reactflow';
import './TaskNode.css';

interface TaskNodeData {
  name: string;
  type: string;
  commands: string[];
}

const TaskNode: React.FC<NodeProps<TaskNodeData>> = ({ data, selected }) => {
  return (
    <div className={`task-node ${selected ? 'selected' : ''}`}>
      <div className="task-node-content">
        <div className="task-node-name">{data.name}</div>
        <div className="task-node-type">{data.type}</div>
      </div>
    </div>
  );
};

export default TaskNode;
