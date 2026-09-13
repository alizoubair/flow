import { createContext, useContext } from 'react';
import { StageRun } from '../components/panels/RunPanel';

interface RunStatusContextValue {
  /** keyed by stage slug: label.toLowerCase().replace(/\s+/g, '-') */
  stageStatuses: Record<string, StageRun>;
}

export const RunStatusContext = createContext<RunStatusContextValue>({
  stageStatuses: {},
});

export function useRunStatus() {
  return useContext(RunStatusContext);
}

/** Convert a stage label to the slug the runner uses */
export function toStageSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}
