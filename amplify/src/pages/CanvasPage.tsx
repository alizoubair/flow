import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import PipelineCanvas from '../components/canvas/PipelineCanvas';
import CanvasToolbar, { CanvasMode } from '../components/canvas/CanvasToolbar';
import ConfigPanel from '../components/panels/ConfigPanel';
import RunPanel from '../components/panels/RunPanel';
import AgentPanel from '../components/agent/AgentPanel';
import { Node, Edge } from 'reactflow';
import { usePipelineStore } from '../store/pipelineStore';
import { pipelineApi } from '../services/api';
import { authService } from '../services/auth';
import { wsService } from '../services/websocket';
import { RunStatusContext } from '../contexts/RunStatusContext';
import { PipelineRun, StageRun, StepRun } from '../components/panels/RunPanel';

const CanvasPage: React.FC = () => {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [componentsOpen, setComponentsOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentMounted, setAgentMounted] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('select');
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);

  const { initPipeline, removeNode, removeEdge, edgeStyle, setEdgeStyle } = usePipelineStore();
  const currentPipelineId = usePipelineStore(s => s.pipelineId);

  const isRunning = activeRun?.status === 'running';

  const stageStatuses = useMemo(() => {
    if (!activeRun) return {};
    return Object.fromEntries(activeRun.stages.map(s => [s.name, s]));
  }, [activeRun]);

  useEffect(() => {
    const bootstrap = async () => {
      const isLoggedIn = authService.isAuthenticated();
      if (pipelineId) {
        if (isLoggedIn) {
          try {
            const pipeline = await pipelineApi.get(pipelineId);
            // Strip animated flag so edges are always solid on load
            const edges = (pipeline.edges || []).map((e: any) => ({ ...e, animated: false }));
            initPipeline(pipeline.id, pipeline.name, pipeline.nodes, edges);
          } catch {
            initPipeline(pipelineId);
          }
        } else {
          const saved = localStorage.getItem(`flow-pipeline-${pipelineId}`);
          if (saved) {
            try { const d = JSON.parse(saved); initPipeline(pipelineId, d.name, d.nodes, (d.edges || []).map((e: any) => ({ ...e, animated: false }))); }
            catch { initPipeline(pipelineId); }
          } else {
            initPipeline(pipelineId);
          }
        }
      } else {
        if (isLoggedIn) {
          try {
            const { pipelines } = await pipelineApi.list();
            if (pipelines.length > 0) {
              const last = pipelines.sort((a, b) =>
                new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
              )[0];
              navigate(`/canvas/pipelines/${last.id}`, { replace: true });
            } else {
              const p = await pipelineApi.create();
              navigate(`/canvas/pipelines/${p.id}`, { replace: true });
            }
          } catch {
            navigate(`/canvas/pipelines/${uuidv4()}`, { replace: true });
          }
        } else {
          navigate(`/canvas/pipelines/${uuidv4()}`, { replace: true });
        }
      }
    };
    bootstrap();
  }, [pipelineId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!wsService.isConnected()) {
      wsService.connect().catch(err => console.warn('WebSocket connect failed:', err));
    }
  }, []);

  useEffect(() => {
    return wsService.onMessage((msg) => {
      if (!msg.run_id) return;

      setActiveRun(prev => {
        if (prev && prev.runId !== msg.run_id) return prev;

        switch (msg.type) {
          case 'pipeline_start': {
            // Always store expectedStages — needed for pipeline_complete to mark stages green.
            // Pre-populate stages as pending only when none exist yet.
            // On durable execution replay, stages already exist but we still update expectedStages.
            const expectedStages: string[] = msg.stages || [];
            const pendingStages: StageRun[] = expectedStages.map((name: string) => ({
              name,
              status: 'pending' as const,
              steps: [],
            }));
            if (!prev) return { runId: msg.run_id, status: 'running', stages: pendingStages, startedAt: Date.now(), expectedStages };
            if (prev.stages.length === 0) return { ...prev, stages: pendingStages, expectedStages };
            // Stages already populated (replay or race) — keep stage state but update expectedStages
            return { ...prev, expectedStages };
          }

          case 'stage_start': {
            const newStage: StageRun = {
              name: msg.stage,
              status: 'running',
              steps: [],
              startedAt: Date.now(),
            };
            if (!prev) return prev;
            const exists = prev.stages.some(s => s.name === msg.stage);
            return {
              ...prev,
              stages: exists
                ? prev.stages.map(s => s.name === msg.stage ? { ...s, status: 'running' as const, startedAt: Date.now() } : s)
                : [...prev.stages, newStage],
            };
          }

          case 'step_output': {
            if (!prev) return prev;
            const step: StepRun = {
              name: msg.step,
              output: msg.output ?? '',
              exitCode: msg.exit_code,
              status: msg.exit_code === 0 ? 'completed' : 'failed',
            };
            return {
              ...prev,
              stages: prev.stages.map(s =>
                s.name === msg.stage
                  ? { ...s, steps: [...s.steps.filter(st => st.name !== msg.step), step] }
                  : s
              ),
            };
          }

          case 'stage_complete': {
            if (!prev) return prev;
            return {
              ...prev,
              stages: prev.stages.map(s =>
                s.name === msg.stage
                  ? { ...s, status: 'completed' as const, duration: s.startedAt ? Date.now() - s.startedAt : undefined }
                  : s
              ),
            };
          }

          case 'pipeline_complete': {
            if (!prev) return prev;
            const expected = new Set(prev.expectedStages || []);
            return {
              ...prev,
              status: 'completed' as const,
              duration: Date.now() - prev.startedAt,
              // Mark all expected stages as completed — pipeline succeeded so all ran
              stages: prev.stages.map(s => ({
                ...s,
                status: expected.has(s.name) ? 'completed' as const : s.status,
              })),
            };
          }

          case 'pipeline_failed':
            if (!prev) return prev;
            return {
              ...prev,
              status: 'failed' as const,
              duration: Date.now() - prev.startedAt,
              stages: prev.stages.map(s =>
                s.status === 'running'
                  ? { ...s, status: 'failed' as const, duration: s.startedAt ? Date.now() - s.startedAt : undefined }
                  : s
              ),
            };

          default:
            return prev;
        }
      });
    });
  }, []);

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
  }, [selectedNodes, selectedEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunPipeline = async () => {
    if (!currentPipelineId || isRunning) return;
    try {
      const { run_id } = await pipelineApi.run(currentPipelineId);
      setActiveRun({ runId: run_id, status: 'running', stages: [], startedAt: Date.now() });
      setRunPanelOpen(true);
    } catch (err) {
      console.error('Failed to start pipeline run:', err);
    }
  };

  const handleDelete = useCallback(() => {
    selectedNodes.forEach(n => removeNode(n.id));
    selectedEdges.forEach(e => removeEdge(e.id));
    setSelectedNodes([]);
    setSelectedEdges([]);
  }, [selectedNodes, selectedEdges, removeNode, removeEdge]);

  // ── Derive right-panel content ─────────────────────────────────────────────
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  const [runPanelOpen, setRunPanelOpen] = useState(false);

  const showConfig = !agentOpen && !runPanelOpen && !!selectedNode;

  return (
    <RunStatusContext.Provider value={{ stageStatuses }}>
      <div className="app">
        <Header />
        <CanvasToolbar
          mode={canvasMode}
          componentsOpen={componentsOpen}
          agentOpen={agentOpen}
          hasSelection={selectedNodes.length > 0 || selectedEdges.length > 0}
          edgeStyle={edgeStyle}
          isRunning={isRunning}
          runStatus={activeRun?.status}
          runPanelOpen={runPanelOpen}
          onToggleOutput={() => setRunPanelOpen(prev => !prev)}
          onModeChange={setCanvasMode}
          onDelete={handleDelete}
          onToggleComponents={() => setComponentsOpen(prev => !prev)}
          onToggleAgent={() => { setAgentOpen(prev => !prev); setAgentMounted(true); }}
          onEdgeStyleChange={setEdgeStyle}
          onRunPipeline={currentPipelineId ? handleRunPipeline : undefined}
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
          {runPanelOpen && (
            <RunPanel run={activeRun ?? undefined} onClose={() => setRunPanelOpen(false)} />
          )}
          {showConfig && <ConfigPanel selectedNode={selectedNode} />}
        </div>
      </div>
    </RunStatusContext.Provider>
  );
};

export default CanvasPage;
