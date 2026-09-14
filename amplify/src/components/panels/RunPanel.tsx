import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle2, XCircle, Clock, Loader, Circle, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import './RunPanel.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepRun {
  name: string;
  output: string;
  exitCode?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface StageRun {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: StepRun[];
  startedAt?: number;
  duration?: number;
}

export interface PipelineRun {
  runId: string;
  status: 'running' | 'completed' | 'failed';
  stages: StageRun[];
  startedAt: number;
  duration?: number;
  /** stage names that were actually dispatched to the MicroVM (from pipeline_start) */
  expectedStages?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function elapsed(since: number): string {
  return fmtMs(Date.now() - since);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusIcon: React.FC<{ status: StageRun['status']; size?: number }> = ({ status, size = 15 }) => {
  if (status === 'completed') return <CheckCircle2 size={size} className="rp-icon completed" />;
  if (status === 'failed')    return <XCircle      size={size} className="rp-icon failed" />;
  if (status === 'running')   return <Loader       size={size} className="rp-icon running" />;
  return                             <Circle       size={size} className="rp-icon pending" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface RunPanelProps {
  run?: PipelineRun;
  onClose: () => void;
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;

const RunPanel: React.FC<RunPanelProps> = ({ run, onClose }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [width, setWidth] = useState(320);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)));
    };
    const onUp = () => { isResizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Tick every second while running (for live elapsed timers)
  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [run?.status]);

  // Auto-expand the currently running stage
  useEffect(() => {
    if (!run) return;
    const running = run.stages.find(s => s.status === 'running');
    if (running) setExpanded(prev => new Set([...prev, running.name]));
  }, [run?.stages]);

  // Scroll logs to bottom on new output
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run?.stages]);

  const toggle = (name: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const totalMs = run ? (run.duration ?? (Date.now() - run.startedAt)) : 0;

  return (
    <div className="run-panel" style={{ width }}>
      {/* Drag-to-resize handle */}
      <div className="rp-resize-handle" onMouseDown={onResizeStart} />

      {/* Header */}
      <div className="rp-header">
        <div className="rp-header-left">
          <Terminal size={15} className="rp-header-icon" />
          <span className="rp-header-title">Pipeline Output</span>
          {run && (
            <span className={`rp-badge ${run.status}`}>
              {run.status === 'running' ? 'RUNNING' : run.status === 'completed' ? 'PASSED' : 'FAILED'}
            </span>
          )}
        </div>
        <div className="rp-header-right">
          {run?.status === 'running'   && <Loader       size={13} className="rp-icon running"   />}
          {run?.status === 'completed' && <CheckCircle2 size={13} className="rp-icon completed" />}
          {run?.status === 'failed'    && <XCircle      size={13} className="rp-icon failed"    />}
          {run && (
            <span className="rp-elapsed">
              <Clock size={11} />
              {run.status === 'running' ? elapsed(run.startedAt) : fmtMs(totalMs)}
            </span>
          )}
          <button className="rp-close" onClick={onClose} aria-label="Close run panel">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* No run yet — placeholder */}
      {!run && (
        <div className="rp-empty" style={{ flexDirection: 'column', gap: 6, padding: '24px 16px' }}>
          <span style={{ fontSize: 13 }}>No runs yet</span>
          <span style={{ fontSize: 12 }}>Click <strong>Run</strong> to execute the pipeline</span>
        </div>
      )}

      {/* Stages */}
      {run && <div className="rp-stages">
        {run.stages.length === 0 && run.status === 'running' && (
          <div className="rp-empty">
            <Loader size={14} className="rp-icon running" />
            <span>Waiting for first stage…</span>
          </div>
        )}

        {run.stages.map(stage => {
          const isOpen = expanded.has(stage.name);
          return (
            <div key={stage.name} className={`rp-stage ${stage.status}`}>
              <button className="rp-stage-row" onClick={() => toggle(stage.name)}>
                <StatusIcon status={stage.status} />
                <span className="rp-stage-name">{stage.name}</span>
                <span className="rp-stage-dur">
                  {stage.status === 'running' && stage.startedAt
                    ? elapsed(stage.startedAt)
                    : stage.duration ? fmtMs(stage.duration) : ''}
                </span>
                {isOpen
                  ? <ChevronDown size={13} className="rp-chevron" />
                  : <ChevronRight size={13} className="rp-chevron" />}
              </button>

              {isOpen && (
                <div className="rp-logs">
                  {stage.steps.length === 0 && (
                    <span className="rp-logs-waiting">waiting for steps…</span>
                  )}
                  {stage.steps.map((step, i) => (
                    <div key={i} className={`rp-step ${step.status}`}>
                      <div className="rp-step-name">
                        {step.status === 'running'
                          ? <Loader size={11} className="rp-icon running" />
                          : step.status === 'failed'
                          ? <XCircle size={11} className="rp-icon failed" />
                          : <CheckCircle2 size={11} className="rp-icon completed" />}
                        <span>{step.name}</span>
                        {step.exitCode !== undefined && step.exitCode !== 0 && (
                          <span className="rp-exit-code">exit {step.exitCode}</span>
                        )}
                      </div>
                      {step.output && (
                        <pre className="rp-step-output">{step.output}</pre>
                      )}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Footer */}
      {run && run.status !== 'running' && (
        <div className={`rp-footer ${run.status}`}>
          {run.status === 'completed'
            ? `Pipeline passed in ${fmtMs(totalMs)}`
            : `Pipeline failed after ${fmtMs(totalMs)}`}
        </div>
      )}
    </div>
  );
};

export default RunPanel;
