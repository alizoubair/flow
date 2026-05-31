import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Play, Loader, Bot, GitBranch, ShieldCheck,
  FileCode2, Search, Clock, RotateCcw, ChevronRight,
  Circle, CheckCircle2, XCircle, Code2, History, Workflow
} from 'lucide-react';
import { wsService } from '../../services/websocket';
import { conversationApi, ConversationItem } from '../../services/api';
import { parsePipelineToReactFlow } from '../../services/pipelineParser';
import { usePipelineStore } from '../../store/pipelineStore';
import './AgentPanel.css';

interface AgentStep {
  agent: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  label: string;
  detail?: string;
  duration?: number;
  summary?: string[];
}

interface GenerationRun {
  id: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed';
  steps: AgentStep[];
  result?: string;
  pipelineMeta?: { stageCount: number; edgeCount: number; stageTypes: string[] };
  createdAt: Date;
  duration?: number;
}

interface AgentPanelProps {
  onClose: () => void;
}

const QUICK_STARTS = [
  { label: 'Node.js API', icon: '⬡', prompt: 'Create a CI/CD pipeline for a Node.js Express API with tests and Docker' },
  { label: 'Python ML', icon: '⬡', prompt: 'Create a pipeline for a Python ML project with training, testing and model export' },
  { label: 'React App', icon: '⬡', prompt: 'Create a pipeline for a React app with lint, test, build and deploy stages' },
  { label: 'Microservices', icon: '⬡', prompt: 'Create a multi-service pipeline with parallel builds and integration tests' },
];

const AGENT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  repo_analysis:        { label: 'Repo Analysis',  icon: <Search size={13} /> },
  pipeline_intelligence:{ label: 'Pipeline',       icon: <GitBranch size={13} /> },
  validation:           { label: 'Validation',     icon: <ShieldCheck size={13} /> },
  export:               { label: 'Export',         icon: <FileCode2 size={13} /> },
};

const AgentPanel: React.FC<AgentPanelProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'generate' | 'output' | 'history'>('generate');
  const [prompt, setPrompt] = useState('');
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const [width, setWidth] = useState(370);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const runStartTime = useRef<number>(0);

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 600;

  // WebSocket connection management
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        setWsConnected(true);
        setWsError(null);
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setWsError(error instanceof Error ? error.message : 'Connection failed');
        setWsConnected(false);
      }
    };

    connectWebSocket();

    // Set up message handler
    const unsubscribe = wsService.onMessage((message) => {
      handleWebSocketMessage(message);
    });

    // Set up error handler
    const unsubscribeError = wsService.onError((error) => {
      console.error('WebSocket error:', error);
      setWsError(error.message);
      setWsConnected(false);
    });

    // Set up close handler
    const unsubscribeClose = wsService.onClose(() => {
      setWsConnected(false);
    });

    return () => {
      unsubscribe();
      unsubscribeError();
      unsubscribeClose();
      wsService.disconnect();
    };
  }, []);

  // Fetch conversation history on mount
  useEffect(() => {
    conversationApi.list(20)
      .then(data => setHistory(data.conversations))
      .catch(err => console.error('Failed to load history:', err))
      .finally(() => setHistoryLoading(false));
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - ev.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  const activeRun = runs.find(r => r.id === activeRunId) || null;
  const isRunning = activeRun?.status === 'running';

  const handleClose = () => {
    onClose();
  };

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    if (!message.type) return;

    const runId = activeRunIdRef.current;
    if (!runId) return;

    switch (message.type) {
      case 'agent_start':
        // Mark agent as running
        if (message.agent) {
          setRuns(prev => prev.map(r => r.id !== runId ? r : {
            ...r,
            steps: r.steps.map(s => s.agent === message.agent
              ? { ...s, status: 'running' }
              : s),
          }));
        }
        break;

      case 'agent_progress':
        // Update agent progress with details
        if (message.agent) {
          const elapsed = Date.now() - runStartTime.current;
          setRuns(prev => prev.map(r => r.id !== runId ? r : {
            ...r,
            steps: r.steps.map(s => s.agent === message.agent
              ? { ...s, status: 'running', detail: message.detail, duration: Math.round(elapsed / 100) / 10 }
              : s),
          }));
        }
        break;

      case 'agent_complete':
        // Mark agent as completed
        if (message.agent) {
          const elapsed = Date.now() - runStartTime.current;
          setRuns(prev => prev.map(r => r.id !== runId ? r : {
            ...r,
            steps: r.steps.map(s => s.agent === message.agent
              ? { ...s, status: 'completed', detail: message.detail, duration: Math.round(elapsed / 100) / 10 }
              : s),
          }));
        }
        break;

      case 'orchestrator_complete':
        // Mark the entire run as completed and render pipeline on canvas
        {
          const totalDuration = Math.round((Date.now() - runStartTime.current) / 100) / 10;
          const resultText = message.result || '';

          // Try to parse pipeline JSON and render on canvas
          const pipeline = parsePipelineToReactFlow(resultText);
          let pipelineMeta: GenerationRun['pipelineMeta'] = undefined;

          if (pipeline) {
            pipelineMeta = {
              stageCount: pipeline.nodes.length,
              edgeCount: pipeline.edges.length,
              stageTypes: pipeline.nodes.map(n => n.data.label as string),
            };
            const { initPipeline, pipelineId } = usePipelineStore.getState();
            const id = pipelineId || `pipeline-${Date.now()}`;
            initPipeline(id, pipeline.name, pipeline.nodes, pipeline.edges);
          }

          // Generate summaries for each step
          const stageTypes = pipelineMeta?.stageTypes || [];
          const stepSummaries: Record<string, string[]> = {
            repo_analysis: ['Analyzed project structure', `Detected stack from prompt`],
            pipeline_intelligence: pipelineMeta
              ? [`${pipelineMeta.stageCount} stages · ${pipelineMeta.edgeCount} connections`, stageTypes.join(' → ')]
              : ['Pipeline generated'],
            validation: [],
            export: [],
          };

          setRuns(prev => prev.map(r => r.id !== runId ? r : {
            ...r,
            status: 'completed',
            duration: totalDuration,
            result: resultText,
            pipelineMeta,
            steps: r.steps.map(s => ({
              ...s,
              status: s.agent === 'validation' || s.agent === 'export' ? s.status : 'completed',
              summary: stepSummaries[s.agent] || [],
            })),
          }));
        }
        break;

      case 'agent_error':
        // Mark run as failed
        setRuns(prev => prev.map(r => r.id !== runId ? r : {
          ...r,
          status: 'failed',
          steps: r.steps.map(s => s.status === 'running' ? { ...s, status: 'failed' } : s),
        }));
        break;
    }
  }, []);

  const handleRun = () => {
    if (!prompt.trim() || isRunning) return;

    if (!wsConnected) {
      alert('WebSocket is not connected. Please check your connection and try again.');
      return;
    }

    const runId = `run-${Date.now()}`;
    const initialSteps: AgentStep[] = [
      { agent: 'repo_analysis',         status: 'idle', label: 'Repository Analysis' },
      { agent: 'pipeline_intelligence', status: 'idle', label: 'Pipeline Intelligence' },
      { agent: 'validation',            status: 'idle', label: 'Validation' },
      { agent: 'export',                status: 'idle', label: 'Export' },
    ];

    const newRun: GenerationRun = {
      id: runId,
      prompt: prompt.trim(),
      status: 'running',
      steps: initialSteps,
      createdAt: new Date(),
    };

    setRuns(prev => [newRun, ...prev]);
    setActiveRunId(runId);
    activeRunIdRef.current = runId;
    setTab('output');
    runStartTime.current = Date.now();

    // Send execution request via WebSocket
    try {
      wsService.executeAgent(prompt.trim());
      setPrompt('');
    } catch (error) {
      setRuns(prev => prev.map(r => r.id !== runId ? r : { ...r, status: 'failed' }));
    }
  };


  const handleValidate = () => {
    if (!activeRun) return;

    // Mark run as running again and set validation step to running
    setRuns(prev => prev.map(r => r.id !== activeRun.id ? r : {
      ...r,
      status: 'running',
      steps: r.steps.map(s => s.agent === 'validation'
        ? { ...s, status: 'running' }
        : s),
    }));

    // Send validation request via WebSocket
    try {
      wsService.send({
        action: 'orchestrator',
        operation: 'execute_pipeline',
        payload: {
          prompt: `Validate this pipeline: ${activeRun.result || ''}`,
          validate: true,
        },
      });
    } catch (error) {
      console.error('Failed to trigger validation:', error);
    }
  };

  const handleRestore = (run: GenerationRun) => {
    setActiveRunId(run.id);
    activeRunIdRef.current = run.id;
    setTab('output');
  };

  const stepIcon = (status: AgentStep['status']) => {
    if (status === 'running')   return <Loader size={13} className="spin" />;
    if (status === 'completed') return <CheckCircle2 size={13} />;
    if (status === 'failed')    return <XCircle size={13} />;
    return <Circle size={13} />;
  };

  return (
    <div className="agent-panel" style={{ width }}>
      {/* Resize handle */}
      <div className="ap-resize-handle" onMouseDown={onResizeStart} />

      {/* Header */}
      <div className="ap-header">
        <div className="ap-header-left">
          <Workflow size={15} className="ap-header-icon" />
          <span className="ap-header-title">Flow Agents</span>
          {wsConnected ? (
            <span className="ap-ws-status connected" title="Connected">●</span>
          ) : (
            <span className="ap-ws-status disconnected" title={wsError || "Disconnected"}>●</span>
          )}
        </div>
        <button className="ap-close" onClick={handleClose} aria-label="Close">
          <X size={15} />
        </button>
      </div>

      {/* Subtitle */}
      <div className="ap-subtitle">
        Describe your stack and let the agent generate a complete CI/CD pipeline — stages, tasks, and connections included.
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        <button className={`ap-tab ${tab === 'generate' ? 'active' : ''}`} onClick={() => setTab('generate')}>
          <Play size={12} /> Generate
        </button>
        <button className={`ap-tab ${tab === 'output' ? 'active' : ''}`} onClick={() => setTab('output')}>
          <Code2 size={12} /> Output
          {activeRun?.status === 'completed' && <span className="ap-tab-dot" />}
        </button>
        <button className={`ap-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <History size={12} /> History
          {(runs.length + history.length) > 0 && <span className="ap-tab-badge">{runs.length + history.length}</span>}
        </button>
      </div>

      {/* Tab: Generate */}
      {tab === 'generate' && (
        <div className="ap-body">
          <div className="ap-section-label">Quick start</div>
          <div className="ap-quickstart-grid">
            {QUICK_STARTS.map(qs => (
              <button key={qs.label} className="ap-qs-card" onClick={() => setPrompt(qs.prompt)}>
                <span className="ap-qs-icon">{qs.icon}</span>
                <span className="ap-qs-label">{qs.label}</span>
                <ChevronRight size={12} className="ap-qs-arrow" />
              </button>
            ))}
          </div>

          <div className="ap-run-btn-spacer" />

          <div className="ap-bottom-group">
            <div className="ap-section-label">Describe your pipeline</div>
            <textarea
              className="ap-prompt-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. Create a CI/CD pipeline for a Node.js API with unit tests, Docker build and deploy to AWS ECS"
              rows={4}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleRun(); }}
            />
            <p className="ap-prompt-hint">⌘ + Enter to run</p>
            <button
              className="ap-run-btn"
              onClick={handleRun}
              disabled={!prompt.trim() || isRunning}
            >
              {isRunning ? <><Loader size={14} className="spin" /> Running…</> : <><Play size={14} /> Run Agent</>}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Output */}
      {tab === 'output' && (
        <div className="ap-body">
          {!activeRun ? (
            <div className="ap-empty">
              <Bot size={32} />
              <p>No output yet</p>
              <span>Run the agent from the Generate tab to see results here.</span>
            </div>
          ) : (
            <>
              {/* Run meta */}
              <div className="ap-run-meta">
                <span className={`ap-run-badge ${activeRun.status}`}>
                  {activeRun.status === 'running' && <Loader size={11} className="spin" />}
                  {activeRun.status === 'completed' && <CheckCircle2 size={11} />}
                  {activeRun.status === 'failed' && <XCircle size={11} />}
                  {activeRun.status}
                </span>
                {activeRun.duration && (
                  <span className="ap-run-duration"><Clock size={11} /> {activeRun.duration}s</span>
                )}
              </div>
              <div className="ap-run-prompt">"{activeRun.prompt}"</div>

              {/* Execution timeline */}
              <div className="ap-timeline">
                {activeRun.steps.map((step, i) => (
                  <React.Fragment key={i}>
                    <div className={`ap-timeline-step ${step.status}`}>
                      <div className="ap-timeline-track">
                        <div className={`ap-timeline-dot ${step.status}`}>{stepIcon(step.status)}</div>
                        {i < activeRun.steps.length - 1 && <div className="ap-timeline-line" />}
                      </div>
                      <div className="ap-timeline-content">
                        <div className="ap-timeline-label">
                          {AGENT_META[step.agent]?.icon}
                          <span>{step.label}</span>
                          {step.duration && <span className="ap-timeline-dur">{step.duration}s</span>}
                        </div>
                        {step.detail && <div className="ap-timeline-detail">{step.detail}</div>}
                        {step.status === 'completed' && step.summary && step.summary.length > 0 && (
                          <div className="ap-timeline-summary">
                            {step.summary.map((item, j) => (
                              <span key={j} className="ap-summary-chip">{item}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Inline action buttons between pipeline_intelligence and validation */}
                    {step.agent === 'pipeline_intelligence' &&
                     activeRun.status === 'completed' &&
                     activeRun.steps.find(s => s.agent === 'validation')?.status === 'idle' && (
                      <div className="ap-timeline-actions">
                        <div className="ap-timeline-track">
                          <div className="ap-timeline-line" />
                        </div>
                        <div className="ap-timeline-actions-content">
                          <button className="ap-inline-btn edit" onClick={handleClose}>
                            <Code2 size={12} /> Edit on Canvas
                          </button>
                          <button className="ap-inline-btn validate" onClick={() => handleValidate()}>
                            <ShieldCheck size={12} /> Validate
                          </button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="ap-body">
          {historyLoading ? (
            <div className="ap-empty">
              <Loader size={32} className="spin" />
              <p>Loading history...</p>
            </div>
          ) : runs.length === 0 && history.length === 0 ? (
            <div className="ap-empty">
              <History size={32} />
              <p>No runs yet</p>
              <span>Your generation history will appear here.</span>
            </div>
          ) : (
            <div className="ap-history-list">
              {/* Current session runs */}
              {runs.map(run => (
                <div key={run.id} className="ap-history-card">
                  <div className="ap-history-card-top">
                    <span className={`ap-run-badge ${run.status}`}>
                      {run.status === 'running'   && <Loader size={10} className="spin" />}
                      {run.status === 'completed' && <CheckCircle2 size={10} />}
                      {run.status === 'failed'    && <XCircle size={10} />}
                      {run.status}
                    </span>
                    <span className="ap-history-time">
                      <Clock size={10} /> {run.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="ap-history-prompt">"{run.prompt}"</p>
                  {run.status === 'completed' && (
                    <button className="ap-restore-btn" onClick={() => handleRestore(run)}>
                      <RotateCcw size={12} /> View Output
                    </button>
                  )}
                </div>
              ))}
              {/* Persisted history from API */}
              {history.map((item, i) => (
                <div key={`hist-${i}`} className="ap-history-card">
                  <div className="ap-history-card-top">
                    <span className="ap-run-badge completed">
                      <CheckCircle2 size={10} /> completed
                    </span>
                    <span className="ap-history-time">
                      <Clock size={10} /> {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="ap-history-prompt">"{item.prompt}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentPanel;