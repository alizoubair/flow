import { create } from 'zustand';
import { Node, Edge } from 'reactflow';

interface PipelineState {
  currentPipeline: {
    name: string;
    lastSaved: Date | null;
  } | null;
  nodes: Node[];
  edges: Edge[];
  hasUnsavedChanges: boolean;

  // Actions
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, data: any) => void;
  addTaskNode: (parentId: string, taskData: any) => void;
  toggleStageExpand: (stageId: string) => void;
  removeNode: (nodeId: string) => void;
  updatePipelineName: (name: string) => void;
  markSaved: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  currentPipeline: {
    name: 'My Pipeline',
    lastSaved: null,
  },
  nodes: [],
  edges: [],
  hasUnsavedChanges: false,

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      hasUnsavedChanges: true,
    }));
  },

  updateNode: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      hasUnsavedChanges: true,
    }));
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

      return {
        nodes: [...updatedNodes, newTaskNode],
        hasUnsavedChanges: true,
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
        };
      }

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        hasUnsavedChanges: true,
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

  markSaved: () => {
    set((state) => ({
      currentPipeline: state.currentPipeline
        ? { ...state.currentPipeline, lastSaved: new Date() }
        : null,
      hasUnsavedChanges: false,
    }));
  },
}));

// Auto-save functionality
let autoSaveTimeout: NodeJS.Timeout;
usePipelineStore.subscribe((state, prevState) => {
  if (state.hasUnsavedChanges && !prevState.hasUnsavedChanges) {
    // Start auto-save timer when changes are detected
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      // TODO: Call Lambda API to save
      console.log('Auto-saving pipeline...', {
        nodes: state.nodes,
        edges: state.edges,
      });
      usePipelineStore.getState().markSaved();
    }, 2000); // Save after 2 seconds of inactivity
  }
});
