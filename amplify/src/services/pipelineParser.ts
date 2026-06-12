import { Node, Edge } from 'reactflow';

/**
 * Stage type to color mapping for visual differentiation
 */
const STAGE_COLORS: Record<string, string> = {
  install: '#10B981',
  lint: '#F59E0B',
  test: '#3B82F6',
  build: '#10B981',
  docker: '#2563EB',
  security: '#EF4444',
  deploy: '#F59E0B',
  checkout: '#6B7280',
};

/**
 * Map agent stage types to the STAGE_ICON_MAP keys used by StageNode
 */
const STAGE_TYPE_TO_ICON_KEY: Record<string, string> = {
  install: 'stage-build',
  lint: 'stage-test',
  test: 'stage-test',
  build: 'stage-build',
  docker: 'stage-build',
  security: 'stage-security',
  deploy: 'stage-deploy',
  checkout: 'stage-build',
};

const TASK_ROW_HEIGHT = 65;
const STAGE_HEADER_HEIGHT = 110;
const STAGE_BASE_HEIGHT = 90;
const STAGE_GAP = 60;

type PipelineTask = {
  id: string;
  name: string;
  type: string;
  commands: string[];
  parallel?: boolean;
};

type PipelineStage = {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
  tasks: PipelineTask[];
};

type PipelineEdge = {
  source: string;
  target: string;
};

type PipelinePayload = {
  name?: string;
  stages: any[];
  edges?: any[];
  connections?: any[];
};

function cleanPipelineJson(pipelineJson: string): string {
  let cleaned = pipelineJson.trim();

  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    try {
      const unwrapped = JSON.parse(cleaned);
      if (typeof unwrapped === 'string') {
        cleaned = unwrapped;
      }
    } catch {
      // Not a JSON-encoded string, continue with original
    }
  }

  cleaned = cleaned.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }

  return cleaned.trim();
}

function extractPipelineObject(parsed: unknown): PipelinePayload | null {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.stages)) {
    return record as PipelinePayload;
  }

  for (const key of ['pipeline', 'result', 'data']) {
    const nested = record[key];
    if (nested && typeof nested === 'object' && Array.isArray((nested as PipelinePayload).stages)) {
      return nested as PipelinePayload;
    }
  }

  return null;
}

function normalizeTasks(rawTasks: unknown, stage: any, stageIndex: number): PipelineTask[] {
  const tasks: PipelineTask[] = [];

  if (Array.isArray(rawTasks)) {
    rawTasks.forEach((rawTask, taskIndex) => {
      const task = rawTask as Record<string, unknown>;
      let commands = task.commands;
      if (typeof commands === 'string') commands = [commands];
      if (!Array.isArray(commands) || commands.length === 0) return;

      tasks.push({
        id: String(task.id || `${stage.id || `stage-${stageIndex + 1}`}-task-${taskIndex + 1}`),
        name: String(task.name || task.label || `Task ${taskIndex + 1}`),
        type: String(task.type || stage.type || 'build'),
        commands: (commands as unknown[]).map((c) => String(c)),
        parallel: Boolean(task.parallel),
      });
    });
  }

  // Derive a single task from inline stage commands when none provided.
  if (tasks.length === 0) {
    const config = (stage.config as Record<string, unknown>) || {};
    let commands = config.commands;
    if (typeof commands === 'string') commands = [commands];
    if (Array.isArray(commands) && commands.length > 0) {
      tasks.push({
        id: `${stage.id || `stage-${stageIndex + 1}`}-task-1`,
        name: String(stage.label || stage.type || 'Run'),
        type: String(stage.type || 'build'),
        commands: (commands as unknown[]).map((c) => String(c)),
        parallel: false,
      });
    }
  }

  return tasks;
}

function normalizeStages(rawStages: any[]): PipelineStage[] {
  return rawStages.map((rawStage, index) => {
    const stage = rawStage as Record<string, unknown>;
    const id = String(stage.id || `stage-${index + 1}`);
    const type = String(stage.type || 'build');
    const label = String(stage.label || stage.name || `Stage ${index + 1}`);

    return {
      id,
      type,
      label,
      config: (stage.config as Record<string, unknown>) || {},
      tasks: normalizeTasks(stage.tasks, { ...stage, id, type, label }, index),
    };
  });
}

function resolveStageRef(ref: unknown, stages: PipelineStage[]): string | null {
  if (typeof ref !== 'string' || !ref) return null;

  if (stages.some((s) => s.id === ref)) return ref;

  const lowerRef = ref.toLowerCase();
  const byLabel = stages.find((s) => s.label.toLowerCase() === lowerRef);
  if (byLabel) return byLabel.id;

  const byType = stages.find((s) => s.type.toLowerCase() === lowerRef);
  if (byType) return byType.id;

  return null;
}

function normalizePipelineEdges(pipeline: PipelinePayload, stages: PipelineStage[]): PipelineEdge[] {
  const rawEdges = pipeline.edges || pipeline.connections || [];
  const normalized: PipelineEdge[] = [];

  if (Array.isArray(rawEdges)) {
    for (const rawEdge of rawEdges) {
      const edge = rawEdge as Record<string, unknown>;
      const source = resolveStageRef(edge.source ?? edge.from ?? edge.start, stages);
      const target = resolveStageRef(edge.target ?? edge.to ?? edge.end, stages);
      if (source && target && source !== target) {
        normalized.push({ source, target });
      }
    }
  }

  if (normalized.length > 0) return normalized;

  // LLM output often omits edges — connect stages in order so lines render.
  return stages.slice(0, -1).map((stage, index) => ({
    source: stage.id,
    target: stages[index + 1].id,
  }));
}

/**
 * Convert agent-generated pipeline JSON into React Flow nodes and edges.
 *
 * The agent returns:
 * {
 *   name: "Pipeline Name",
 *   stages: [{ id, type, label, config, tasks: [{ id, name, type, commands }] }],
 *   edges: [{ source, target }]
 * }
 */
export function parsePipelineToReactFlow(pipelineJson: string): {
  name: string;
  nodes: Node[];
  edges: Edge[];
} | null {
  try {
    const cleaned = cleanPipelineJson(pipelineJson);
    const parsed = JSON.parse(cleaned);
    const pipeline = extractPipelineObject(parsed);

    if (!pipeline?.stages || !Array.isArray(pipeline.stages)) {
      return null;
    }

    const stages = normalizeStages(pipeline.stages);
    const pipelineEdges = normalizePipelineEdges(pipeline, stages);

    const nodes: Node[] = [];
    let currentY = 0;

    stages.forEach((stage) => {
      const taskCount = stage.tasks.length;
      const stageHeight = taskCount > 0
        ? STAGE_HEADER_HEIGHT + taskCount * TASK_ROW_HEIGHT
        : STAGE_BASE_HEIGHT;

      nodes.push({
        id: stage.id,
        type: 'stageNode',
        position: { x: 100, y: currentY },
        style: { width: 220, height: taskCount > 0 ? stageHeight : undefined },
        data: {
          label: stage.type.charAt(0).toUpperCase() + stage.type.slice(1),
          stageType: STAGE_TYPE_TO_ICON_KEY[stage.type] || 'stage-build',
          stageName: stage.label,
          color: STAGE_COLORS[stage.type] || '#6B7280',
          config: stage.config || {},
          isExpanded: true,
          taskCount,
        },
      });

      stage.tasks.forEach((task, taskIndex) => {
        nodes.push({
          id: task.id,
          type: 'taskNode',
          position: { x: 20, y: 90 + taskIndex * TASK_ROW_HEIGHT },
          parentId: stage.id,
          extent: 'parent' as const,
          draggable: true,
          data: {
            name: task.name,
            type: task.type,
            commands: task.commands,
            parallel: task.parallel ?? false,
          },
        });
      });

      currentY += stageHeight + STAGE_GAP;
    });

    const edges: Edge[] = pipelineEdges.map((edge, index) => ({
      id: `edge-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: true,
    }));

    return {
      name: pipeline.name || 'Generated Pipeline',
      nodes,
      edges,
    };
  } catch (err) {
    console.error('Failed to parse pipeline JSON:', err);
    return null;
  }
}
