import { create } from 'zustand';
import { Node, Edge } from 'reactflow';
import { pipelineApi } from '../services/api';
import { authService } from '../services/auth';

export type Theme = 'light' | 'dark';
export type CanvasBackground = 'dots' | 'lines' | 'grid' | 'none';
export type EdgeStyle = 'smoothstep' | 'solid' | 'dashed' | 'animated';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'local';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface PipelineState {
  pipelineId: string | null;
  currentPipeline: {
    name: string;
    lastSaved: Date | null;
  } | null;
  nodes: Node[];
  edges: Edge[];
  hasUnsavedChanges: boolean;
  saveStatus: SaveStatus;
  theme: Theme;
  canvasBackground: CanvasBackground;
  canvasBackgroundColor: string;
  edgeStyle: EdgeStyle;

  history: HistoryState[];
  historyIndex: number;

  // Actions
  setPipelineId: (id: string) => void;
  initPipeline: (id: string, name?: string, nodes?: Node[], edges?: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, data: any) => void;
  addTaskNode: (parentId: string, taskData: any) => void;
  toggleStageExpand: (stageId: string) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updatePipelineName: (name: string) => void;
  resetCanvas: () => void;
  setTheme: (theme: Theme) => void;
  setCanvasBackground: (background: CanvasBackground) => void;
  setCanvasBackgroundColor: (color: string) => void;
  setEdgeStyle: (style: EdgeStyle) => void;
  markSaved: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  deletePipeline: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Helper function to save state to history
const saveToHistory = (state: PipelineState, newNodes: Node[], newEdges: Edge[]) => {
  const currentState = { nodes: newNodes, edges: newEdges };
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(currentState);

  // Limit history to 50 states
  if (newHistory.length > 50) {
    newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }

  return { history: newHistory, historyIndex: newHistory.length - 1 };
};

export const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelineId: null,
  currentPipeline: {
    name: 'Untitled Pipeline',
    lastSaved: null,
  },
  nodes: [],
  edges: [],
  hasUnsavedChanges: false,
  saveStatus: 'saved',
  theme: 'light',
  canvasBackground: 'dots',
  canvasBackgroundColor: '#F7F8FA',
  edgeStyle: 'solid' as EdgeStyle,
  history: [{ nodes: [], edges: [] }],
  historyIndex: 0,

  setPipelineId: (id) => set({ pipelineId: id }),

  initPipeline: (id, name = 'Untitled Pipeline', nodes = [], edges = []) => {
    set({
      pipelineId: id,
      currentPipeline: { name, lastSaved: null },
      nodes,
      edges,
      hasUnsavedChanges: false,
      saveStatus: 'saved',
      history: [{ nodes, edges }],
      historyIndex: 0,
    });
  },

  addNode: (node) => {
    set((state) => {
      const newNodes = [...state.nodes, node];
      return {
        nodes: newNodes,
        hasUnsavedChanges: true,
        ...saveToHistory(state, newNodes, state.edges),
      };
    });
  },

  updateNode: (nodeId, data) => {
    set((state) => {
      const newNodes = state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      );
      return {
        nodes: newNodes,
        hasUnsavedChanges: true,
        ...saveToHistory(state, newNodes, state.edges),
      };
    });
  },

  addTaskNode: (parentId, taskData) => {
    set((state) => {
      const parentNode = state.nodes.find((n) => n.id === parentId);
      if (!parentNode) return state;

      const childNodes = state.nodes.filter((n) => n.parentId === parentId);
      const yOffset = 90 + childNodes.length * 65;

      const newTaskNode: Node = {
        id: `task-${Date.now()}`,
        type: 'taskNode',
        position: { x: 20, y: yOffset },
        data: taskData,
        parentId: parentId,
        extent: 'parent' as any,
        draggable: true,
      };

      // Update parent task count and ensure it's expanded
      const updatedNodes = state.nodes.map((node) =>
        node.id === parentId
          ? {
              ...node,
              style: { ...node.style, width: 220, height: 110 + (childNodes.length + 1) * 65 },
              data: { ...node.data, taskCount: childNodes.length + 1, isExpanded: true },
            }
          : node
      );

      const newNodes = [...updatedNodes, newTaskNode];
      return {
        nodes: newNodes,
        hasUnsavedChanges: true,
        ...saveToHistory(state, newNodes, state.edges),
      };
    });
  },

  toggleStageExpand: (stageId) => {
    set((state) => {
      const childCount = state.nodes.filter((n) => n.parentId === stageId).length;

      return {
        nodes: state.nodes.map((node) => {
          if (node.id === stageId) {
            const isExpanded = !node.data.isExpanded;
            const height = isExpanded && childCount > 0
              ? 110 + childCount * 65
              : undefined;

            return {
              ...node,
              style: { ...node.style, height },
              data: { ...node.data, isExpanded },
            };
          }
          return node;
        }),
      };
    });
  },

  removeNode: (nodeId) => {
    set((state) => {
      const nodeToRemove = state.nodes.find((n) => n.id === nodeId);

      // Filter out the node and all its children
      const filteredNodes = state.nodes.filter(
        (node) => node.id !== nodeId && node.parentId !== nodeId
      );

      // Filter out all edges connected to this node
      const filteredEdges = state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );

      // Update parent task count and reposition tasks if removing a task
      if (nodeToRemove?.parentId) {
        const parentId = nodeToRemove.parentId;
        const remainingChildren = filteredNodes.filter((n) => n.parentId === parentId);

        // Reposition remaining tasks sequentially
        const updatedNodes = filteredNodes.map((node) => {
          if (node.id === parentId) {
            // Update parent task count and height
            const newHeight = remainingChildren.length > 0
              ? 110 + remainingChildren.length * 65
              : undefined;
            return {
              ...node,
              style: { ...node.style, height: newHeight },
              data: { ...node.data, taskCount: remainingChildren.length },
            };
          } else if (node.parentId === parentId) {
            // Reposition task nodes
            const taskIndex = remainingChildren.findIndex((n) => n.id === node.id);
            return {
              ...node,
              position: { x: 20, y: 90 + taskIndex * 65 },
            };
          }
          return node;
        });

        return {
          nodes: updatedNodes,
          edges: filteredEdges,
          hasUnsavedChanges: true,
          ...saveToHistory(state, updatedNodes, filteredEdges),
        };
      }

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        hasUnsavedChanges: true,
        ...saveToHistory(state, filteredNodes, filteredEdges),
      };
    });
  },

  removeEdge: (edgeId) => {
    set((state) => {
      const filteredEdges = state.edges.filter((edge) => edge.id !== edgeId);
      return {
        edges: filteredEdges,
        hasUnsavedChanges: true,
        ...saveToHistory(state, state.nodes, filteredEdges),
      };
    });
  },

  updatePipelineName: (name) => {
    set((state) => ({
      currentPipeline: state.currentPipeline
        ? { ...state.currentPipeline, name }
        : null,
      hasUnsavedChanges: true,
    }));
  },

  resetCanvas: () => {
    set((state) => ({
      nodes: [],
      edges: [],
      hasUnsavedChanges: true,
      ...saveToHistory(state, [], []),
    }));
  },

  setTheme: (theme) => {
    set({ theme });
    // Apply theme to document root and body
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';

    // Update canvas background color when switching themes
    const currentBgColor = usePipelineStore.getState().canvasBackgroundColor;
    // If user hasn't customized the background color (still default light gray)
    if (currentBgColor === '#F7F8FA' && theme === 'dark') {
      set({ canvasBackgroundColor: '#1e1e1e' });
    } else if (currentBgColor === '#1e1e1e' && theme === 'light') {
      set({ canvasBackgroundColor: '#F7F8FA' });
    }
  },

  setCanvasBackground: (background) => {
    set({ canvasBackground: background });
  },

  setCanvasBackgroundColor: (color) => {
    set({ canvasBackgroundColor: color });
  },

  setEdgeStyle: (style) => {
    set({ edgeStyle: style });
  },

  markSaved: () => {
    set((state) => ({
      currentPipeline: state.currentPipeline
        ? { ...state.currentPipeline, lastSaved: new Date() }
        : null,
      hasUnsavedChanges: false,
      saveStatus: authService.isAuthenticated() ? 'saved' : 'local',
    }));
  },

  setSaveStatus: (status) => set({ saveStatus: status }),

  deletePipeline: async () => {
    const { pipelineId } = get();
    if (!pipelineId) return;

    if (authService.isAuthenticated()) {
      await pipelineApi.delete(pipelineId);
    } else {
      localStorage.removeItem(`flow-pipeline-${pipelineId}`);
    }

    // Reset store state
    set({
      pipelineId: null,
      currentPipeline: { name: 'Untitled Pipeline', lastSaved: null },
      nodes: [],
      edges: [],
      hasUnsavedChanges: false,
      saveStatus: 'saved',
      history: [{ nodes: [], edges: [] }],
      historyIndex: 0,
    });
  },

  undo: () => {
    set((state) => {
      if (state.historyIndex > 0) {
        const newIndex = state.historyIndex - 1;
        const previousState = state.history[newIndex];
        return {
          nodes: previousState.nodes,
          edges: previousState.edges,
          historyIndex: newIndex,
          hasUnsavedChanges: true,
        };
      }
      return state;
    });
  },

  redo: () => {
    set((state) => {
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const nextState = state.history[newIndex];
        return {
          nodes: nextState.nodes,
          edges: nextState.edges,
          historyIndex: newIndex,
          hasUnsavedChanges: true,
        };
      }
      return state;
    });
  },

  canUndo: () => {
    return get().historyIndex > 0;
  },

  canRedo: () => {
    return get().historyIndex < get().history.length - 1;
  },
}));

// Auth-aware autosave — debounced 3s after last change
let autoSaveTimeout: NodeJS.Timeout;

usePipelineStore.subscribe((state, prevState) => {
  if (!state.hasUnsavedChanges || state.hasUnsavedChanges === prevState.hasUnsavedChanges) return;

  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    const { pipelineId, nodes, edges, currentPipeline, markSaved, setSaveStatus } = usePipelineStore.getState();
    if (!pipelineId) return;

    const name = currentPipeline?.name || 'Untitled Pipeline';

    if (authService.isAuthenticated()) {
      // Logged in — save to DynamoDB via update_pipeline Lambda
      setSaveStatus('saving');
      try {
        await pipelineApi.update(pipelineId, { name, nodes, edges });
        markSaved();
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      }
    } else {
      // Anonymous — save to localStorage
      localStorage.setItem(
        `flow-pipeline-${pipelineId}`,
        JSON.stringify({ name, nodes, edges, savedAt: new Date().toISOString() })
      );
      markSaved();
    }
  }, 3000);
});
