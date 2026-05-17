import React, { useState } from 'react';
import { Node } from 'reactflow';
import {
  Plus,
  Trash2,
  Layers
} from 'lucide-react';
import { usePipelineStore } from '../../store/pipelineStore';
import { STAGE_ICON_MAP } from '../../types/nodeTypes';
import './ConfigPanel.css';

interface ConfigPanelProps {
  selectedNode: Node | null;
}

interface Task {
  id: string;
  name: string;
  type: string;
  commands: string[];
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ selectedNode }) => {
  const { updateNode, addTaskNode, removeNode, nodes: storeNodes } = usePipelineStore();
  const [activeTab, setActiveTab] = useState<'setup' | 'tasks' | 'advanced'>('setup');
  const [stageName, setStageName] = useState(selectedNode?.data?.stageName || selectedNode?.data?.name || 'Unnamed Stage');
  const [taskType, setTaskType] = useState(selectedNode?.data?.type || 'build');
  const [commands, setCommands] = useState<string[]>(selectedNode?.data?.commands || []);

  const isStageNode = selectedNode?.type === 'stageNode';
  const isTaskNode = selectedNode?.type === 'taskNode';

  // Get parent stage if task is selected
  const parentStage = React.useMemo(() => {
    if (selectedNode && isTaskNode && selectedNode.parentId) {
      return storeNodes.find((node) => node.id === selectedNode.parentId);
    }
    return null;
  }, [selectedNode, isTaskNode, storeNodes]);

  // Use parent stage for display if task is selected
  const displayNode = isTaskNode && parentStage ? parentStage : selectedNode;
  const IconComponent = displayNode ? STAGE_ICON_MAP[displayNode.data?.stageType] || Layers : Layers;

  // Get child task nodes
  const taskNodes = React.useMemo(() => {
    const stageId = isTaskNode && parentStage ? parentStage.id : selectedNode?.id;
    if (stageId) {
      return storeNodes.filter((node) => node.parentId === stageId);
    }
    return [];
  }, [selectedNode, isTaskNode, parentStage, storeNodes]);

  // Update local state when selectedNode changes
  React.useEffect(() => {
    if (selectedNode) {
      if (isTaskNode) {
        setStageName(selectedNode.data?.name || 'Unnamed Task');
        setTaskType(selectedNode.data?.type || 'build');
        setCommands(selectedNode.data?.commands || []);
        setActiveTab('tasks'); // Auto-switch to Tasks tab when task is selected
      } else {
        setStageName(selectedNode.data?.stageName || 'Unnamed Stage');
        setActiveTab('setup');
      }
    }
  }, [selectedNode, isTaskNode]);

  const handleAddTask = () => {
    const stageId = isTaskNode && parentStage ? parentStage.id : selectedNode?.id;
    if (stageId) {
      addTaskNode(stageId, {
        name: 'New Task',
        type: 'build',
        commands: [],
      });
    }
  };

  const handleDeleteTask = (taskId: string) => {
    removeNode(taskId);
  };

  const handleSave = () => {
    if (selectedNode) {
      if (isStageNode) {
        updateNode(selectedNode.id, { stageName });
      } else if (isTaskNode) {
        updateNode(selectedNode.id, {
          name: stageName,
          type: taskType,
          commands,
        });
      }
    }
  };

  const handleCancel = () => {
    if (selectedNode) {
      if (isTaskNode) {
        setStageName(selectedNode.data?.name || 'Unnamed Task');
        setTaskType(selectedNode.data?.type || 'build');
        setCommands(selectedNode.data?.commands || []);
      } else {
        setStageName(selectedNode.data?.stageName || 'Unnamed Stage');
      }
    }
  };

  if (!selectedNode || !displayNode) {
    return null;
  }

  return (
    <aside className="config-panel">
      <div className="config-header">
        <div className="config-node-info">
          <div className="config-node-icon" style={{
            backgroundColor: `${displayNode.data.color || '#6B7280'}20`,
            color: displayNode.data.color || '#6B7280'
          }}>
            <IconComponent size={20} />
          </div>
          <div>
            <h3>{displayNode.data.label}</h3>
            <p className="config-node-type">Stage</p>
          </div>
        </div>
      </div>

      <div className="config-tabs">
        <button
          className={`tab ${activeTab === 'setup' ? 'active' : ''}`}
          onClick={() => setActiveTab('setup')}
        >
          Setup
        </button>
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab ${activeTab === 'advanced' ? 'active' : ''}`}
          onClick={() => setActiveTab('advanced')}
        >
          Advanced
        </button>
      </div>

      <div className="config-content">
        {activeTab === 'setup' && !isTaskNode && (
          <>
            <div className="config-section">
              <label>Stage Type</label>
              <input
                type="text"
                value={displayNode.data.label}
                disabled
                style={{ background: '#f9fafb', cursor: 'not-allowed' }}
              />
            </div>

            <div className="config-section">
              <label>Stage Name *</label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Enter stage name (e.g., Build Frontend)"
              />
            </div>

            <div className="config-section">
              <label>Description</label>
              <textarea
                placeholder="Describe what this stage does..."
                rows={3}
              />
            </div>

            <div className="config-section">
              <label>Execution Mode</label>
              <select>
                <option>Sequential (tasks run one after another)</option>
                <option>Parallel (all tasks run simultaneously)</option>
              </select>
            </div>
          </>
        )}

        {activeTab === 'tasks' && (
          <>
            <div className="tasks-header">
              <button className="add-task-btn" onClick={handleAddTask}>
                <Plus size={16} />
                Add Task
              </button>
            </div>

            {taskNodes.length === 0 ? (
              <div className="tasks-empty">
                <p>No tasks yet. Click "Add Task" to create one.</p>
              </div>
            ) : (
              <div className="tasks-list">
                {taskNodes.map((taskNode, index) => (
                  <div key={taskNode.id} className="task-item">
                    <div className="task-item-header">
                      <span className="task-order">{index + 1}</span>
                      <input
                        type="text"
                        value={taskNode.data.name}
                        className="task-name-input"
                        placeholder="Task name"
                        onChange={(e) => {
                          updateNode(taskNode.id, { name: e.target.value });
                        }}
                      />
                      <button
                        className="task-action-btn delete"
                        onClick={() => handleDeleteTask(taskNode.id)}
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="task-item-details">
                      <div className="config-section-compact">
                        <label>Type</label>
                        <select
                          value={taskNode.data.type}
                          onChange={(e) => {
                            updateNode(taskNode.id, { type: e.target.value });
                          }}
                        >
                          <option value="install">Install</option>
                          <option value="build">Build</option>
                          <option value="test">Test</option>
                          <option value="lint">Lint</option>
                          <option value="security">Security Scan</option>
                          <option value="docker">Docker Build</option>
                          <option value="deploy">Deploy</option>
                        </select>
                      </div>
                      <div className="config-section-compact">
                        <label>Commands</label>
                        <textarea
                          placeholder="npm ci&#10;npm run build"
                          rows={2}
                          value={(taskNode.data.commands || []).join('\n')}
                          onChange={(e) => {
                            updateNode(taskNode.id, {
                              commands: e.target.value.split('\n'),
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}


        {activeTab === 'advanced' && (
          <>
            <div className="config-section">
              <label>Stage ID</label>
              <input type="text" value={selectedNode.id} disabled />
            </div>
            <div className="config-section">
              <label>Retry on Failure</label>
              <select>
                <option>No</option>
                <option>Yes (3 times)</option>
                <option>Yes (5 times)</option>
              </select>
            </div>
            <div className="config-section">
              <label>Timeout (minutes)</label>
              <input type="number" placeholder="30" min="1" />
            </div>
            <div className="config-section">
              <label>Condition</label>
              <textarea
                placeholder="Run only if: branch == 'main'"
                rows={2}
              />
            </div>
          </>
        )}
      </div>

      <div className="config-footer">
        <button className="config-btn cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button className="config-btn save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </aside>
  );
};

export default ConfigPanel;
