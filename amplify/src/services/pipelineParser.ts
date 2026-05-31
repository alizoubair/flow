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

/**
 * Convert agent-generated pipeline JSON into React Flow nodes and edges.
 *
 * The agent returns:
 * {
 *   name: "Pipeline Name",
 *   stages: [{ id, type, label, config }],
 *   edges: [{ source, target }]
 * }
 *
 * This converts to React Flow format with auto-layout.
 */
export function parsePipelineToReactFlow(pipelineJson: string): {
  name: string;
  nodes: Node[];
  edges: Edge[];
} | null {
  try {
    let cleaned = pipelineJson.trim();

    // If the result is a JSON-encoded string (wrapped in quotes), unwrap it first
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      try {
        const unwrapped = JSON.parse(cleaned);
        if (typeof unwrapped === 'string') {
          cleaned = unwrapped;
        }
      } catch {
        // Not a JSON-encoded string, continue with original
      }
    }

    // Strip markdown fences if present
    cleaned = cleaned.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
    }

    const pipeline = JSON.parse(cleaned);

    if (!pipeline.stages || !Array.isArray(pipeline.stages)) {
      return null;
    }

    // Convert stages to React Flow nodes with vertical layout
    const nodes: Node[] = pipeline.stages.map((stage: any, index: number) => ({
      id: stage.id,
      type: 'stageNode',
      position: { x: 100, y: index * 180 },
      style: { width: 220 },
      data: {
        label: stage.type.charAt(0).toUpperCase() + stage.type.slice(1),
        stageType: STAGE_TYPE_TO_ICON_KEY[stage.type] || 'stage-build',
        stageName: stage.label,
        color: STAGE_COLORS[stage.type] || '#6B7280',
        config: stage.config || {},
        isExpanded: true,
        taskCount: 0,
      },
    }));

    // Convert edges to React Flow format
    const edges: Edge[] = (pipeline.edges || []).map((edge: any, index: number) => ({
      id: `edge-${index}`,
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
