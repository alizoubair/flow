import React from 'react';
import { STAGE_TYPES, TASK_TYPES } from '../../types/nodeTypes';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const onDragStart = (event: React.DragEvent, itemType: string, label: string, color: string, category: 'stage' | 'task') => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: itemType, label, color, category }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Components</h3>
        <p className="sidebar-subtitle">Drag to canvas</p>
      </div>
      <div className="node-palette">
        <div className="node-category">
          <h4>Pipeline Stages</h4>
          {STAGE_TYPES.map((stage) => {
            const IconComponent = stage.icon;
            return (
              <div
                key={stage.type}
                className="node-item"
                draggable
                onDragStart={(e) => onDragStart(e, stage.type, stage.label, stage.color, 'stage')}
              >
                <div className="node-item-icon" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                  <IconComponent size={18} />
                </div>
                <div className="node-item-content">
                  <div className="node-item-label">{stage.label}</div>
                  <div className="node-item-description">{stage.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="node-category">
          <h4>Tasks</h4>
          {TASK_TYPES.map((task) => {
            const IconComponent = task.icon;
            return (
              <div
                key={task.type}
                className="node-item"
                draggable
                onDragStart={(e) => onDragStart(e, task.type, task.label, task.color, 'task')}
              >
                <div className="node-item-icon" style={{ backgroundColor: `${task.color}20`, color: task.color }}>
                  <IconComponent size={18} />
                </div>
                <div className="node-item-content">
                  <div className="node-item-label">{task.label}</div>
                  <div className="node-item-description">{task.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
