import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import PipelineCanvas from '../components/canvas/PipelineCanvas';
import CanvasToolbar, { CanvasMode } from '../components/canvas/CanvasToolbar';
import ConfigPanel from '../components/panels/ConfigPanel';
import AgentPanel from '../components/agent/AgentPanel';
import { Node, Edge } from 'reactflow';
import { usePipelineStore } from '../store/pipelineStore';
import { pipelineApi } from '../services/api';
import { authService } from '../services/auth';

const CanvasPage: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [componentsOpen, setComponentsOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMounted, setAgentMounted] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select');

  const { initPipeline, removeNode, removeEdge, edgeStyle, setEdgeStyle } = usePipelineStore();

  // Keyboard shortcuts: V = select, H = hand, Delete = delete selected
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'v' || e.key === 'V') setCanvasMode('select');
      if (e.key === 'h' || e.key === 'H') setCanvasMode('hand');
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedNodes.length > 0 || selectedEdges.length > 0)) {
        e.preventDefault();
        handleDelete();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedNodes, selectedEdges]);

  // Bootstrap: load or create pipeline
  useEffect(() => {
    const bootstrap = async () => {
      const isLoggedIn = authService.isAuthenticated();

      // If pipelineId is in URL, load that specific pipeline
      if (pipelineId) {
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
      } else {
        // No pipelineId - load last pipeline or create new one
        if (isLoggedIn) {
          try {
            const { pipelines } = await pipelineApi.list();
            if (pipelines.length > 0) {
              // Load the most recently updated pipeline
              const lastPipeline = pipelines.sort((a, b) => {
                const timeA = new Date(a.updated_at).getTime();
                const timeB = new Date(b.updated_at).getTime();
                return timeB - timeA;
              })[0];
              navigate(`/canvas/pipelines/${lastPipeline.id}`, { replace: true });
            } else {
              // No pipelines, create a new one
              const pipeline = await pipelineApi.create();
              navigate(`/canvas/pipelines/${pipeline.id}`, { replace: true });
            }
          } catch (err) {
            console.error('Failed to load pipelines:', err);
            // Fallback: create local pipeline
            const id = uuidv4();
            navigate(`/canvas/pipelines/${id}`, { replace: true });
          }
        } else {
          // Anonymous user - create local pipeline
          const id = uuidv4();
          navigate(`/canvas/pipelines/${id}`, { replace: true });
        }
      }
    };

    bootstrap();
  }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = () => {
    selectedNodes.forEach(n => removeNode(n.id));
    selectedEdges.forEach(e => removeEdge(e.id));
    setSelectedNodes([]);
    setSelectedEdges([]);
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
        hasSelection={selectedNodes.length > 0 || selectedEdges.length > 0}
        edgeStyle={edgeStyle}
        onModeChange={setCanvasMode}
        onDelete={handleDelete}
        onToggleComponents={() => setComponentsOpen(prev => !prev)}
        onToggleAgent={() => {
          setAgentOpen(prev => !prev);
          setAgentMounted(true);
        }}
        onEdgeStyleChange={setEdgeStyle}
      />
      <div className="app-content">
        <Sidebar visible={componentsOpen} />
        <PipelineCanvas
          onNodeSelect={() => {}}
          onSelectionChange={(nodes, edges) => {
            setSelectedNodes(nodes);
            setSelectedEdges(edges || []);
          }}
          mode={canvasMode}
        />
        {agentMounted && (
          <div style={{ display: agentOpen ? 'contents' : 'none' }}>
            <AgentPanel onClose={() => setAgentOpen(false)} />
          </div>
        )}
        {!agentOpen && selectedNode && (
          <ConfigPanel selectedNode={selectedNode} />
        )}
      </div>
    </div>
  );
};

export default CanvasPage;
