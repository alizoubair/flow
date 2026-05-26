import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import PipelineCanvas from '../components/canvas/PipelineCanvas';
import CanvasToolbar, { CanvasMode } from '../components/canvas/CanvasToolbar';
import ConfigPanel from '../components/panels/ConfigPanel';
import AgentPanel from '../components/agent/AgentPanel';
import { Node } from 'reactflow';
import { usePipelineStore } from '../store/pipelineStore';
import { pipelineApi } from '../services/api';
import { authService } from '../services/auth';

const CanvasPage: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [componentsOpen, setComponentsOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select');

  const { initPipeline, removeNode } = usePipelineStore();

  // Keyboard shortcuts: V = select, H = hand, Delete = delete selected
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'v' || e.key === 'V') setCanvasMode('select');
      if (e.key === 'h' || e.key === 'H') setCanvasMode('hand');
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodes.length > 0) {
        e.preventDefault();
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedNodes]);

  // Bootstrap: auto-create or load pipeline
  useEffect(() => {
    const bootstrap = async () => {
      const isLoggedIn = authService.isAuthenticated();

      if (!pipelineId) {
        if (isLoggedIn) {
          try {
            const pipeline = await pipelineApi.create();
            navigate(`/pipelines/${pipeline.id}`, { replace: true });
          } catch (err) {
            console.error('Failed to create pipeline:', err);
            const id = uuidv4();
            navigate(`/pipelines/${id}`, { replace: true });
          }
        } else {
          const id = uuidv4();
          navigate(`/pipelines/${id}`, { replace: true });
        }
        return;
      }

      if (isLoggedIn) {
        try {
          const pipeline = await pipelineApi.get(pipelineId);
          initPipeline(pipeline.id, pipeline.name, pipeline.nodes, pipeline.edges);
        } catch (err) {
          console.error('Failed to load pipeline:', err);
          initPipeline(pipelineId);
        }
      } else {
        const saved = localStorage.getItem(`flow-pipeline-${pipelineId}`);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            initPipeline(pipelineId, data.name, data.nodes, data.edges);
          } catch {
            initPipeline(pipelineId);
          }
        } else {
          initPipeline(pipelineId);
        }
      }
    };

    bootstrap();
  }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = () => {
    selectedNodes.forEach(n => removeNode(n.id));
    setSelectedNodes([]);
  };

  // Single selected node for ConfigPanel
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  return (
    <div className="app">
      <Header />
      <CanvasToolbar
        mode={canvasMode}
        componentsOpen={componentsOpen}
        agentOpen={agentOpen}
        hasSelection={selectedNodes.length > 0}
        onModeChange={setCanvasMode}
        onDelete={handleDelete}
        onToggleComponents={() => setComponentsOpen(prev => !prev)}
        onToggleAgent={() => setAgentOpen(prev => !prev)}
      />
      <div className="app-content">
        <Sidebar visible={componentsOpen} />
        <PipelineCanvas
          onNodeSelect={() => {}}
          onSelectionChange={setSelectedNodes}
          mode={canvasMode}
        />
        {agentOpen ? (
          <AgentPanel onClose={() => setAgentOpen(false)} />
        ) : selectedNode ? (
          <ConfigPanel selectedNode={selectedNode} />
        ) : null}
      </div>
    </div>
  );
};

export default CanvasPage;
