import React, { useState } from 'react';
import { CheckCircle2, XCircle, Loader, Clock } from 'lucide-react';
import { StageRun } from './RunPanel';
import './StageRunPanel.css';

interface StageRunPanelProps {
  stageName: string;
  stage: StageRun;
  runElapsed?: string;
}

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const StageRunPanel: React.FC<StageRunPanelProps> = ({ stageName, stage, runElapsed }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const duration = stage.duration ? fmtMs(stage.duration)
    : stage.startedAt ? fmtMs(Date.now() - stage.startedAt)
    : null;

  return (
    <div className="srp">
      <div className="srp-header">
        <div className="srp-title">
          {stage.status === 'running'   && <Loader       size={14} className="srp-icon running" />}
          {stage.status === 'completed' && <CheckCircle2 size={14} className="srp-icon completed" />}
          {stage.status === 'failed'    && <XCircle      size={14} className="srp-icon failed" />}
          <span className="srp-name">{stageName}</span>
          <span className={`srp-badge ${stage.status}`}>
            {stage.status === 'running' ? 'RUNNING' : stage.status === 'completed' ? 'PASSED' : 'FAILED'}
          </span>
        </div>
        {duration && (
          <div className="srp-elapsed">
            <Clock size={11} />
            {duration}
          </div>
        )}
      </div>

      <div className="srp-steps">
        {stage.steps.length === 0 && (
          <div className="srp-waiting">
            <Loader size={12} className="srp-icon running" />
            <span>Waiting for steps…</span>
          </div>
        )}

        {stage.steps.map((step, i) => (
          <div key={i} className={`srp-step ${step.status}`}>
            <button className="srp-step-header" onClick={() => setExpanded(expanded === i ? null : i)}>
              {step.status === 'running'   && <Loader       size={12} className="srp-icon running" />}
              {step.status === 'completed' && <CheckCircle2 size={12} className="srp-icon completed" />}
              {step.status === 'failed'    && <XCircle      size={12} className="srp-icon failed" />}
              <span className="srp-step-name">{step.name}</span>
              {step.exitCode !== undefined && step.exitCode !== 0 && (
                <span className="srp-exit">exit {step.exitCode}</span>
              )}
            </button>
            {expanded === i && step.output && (
              <pre className="srp-output">{step.output}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StageRunPanel;
