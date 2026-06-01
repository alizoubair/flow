import React, { useCallback, useRef, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  NodeTypes,
  BackgroundVariant,
  OnSelectionChangeParams,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { usePipelineStore } from '../../store/pipelineStore';
import StageNode from './nodes/StageNode';
import TaskNode from './nodes/TaskNode';
import { Plus, Minus, Maximize2, Undo2, Redo2 } from 'lucide-react';
import './PipelineCanvas.css';


import { CanvasMode } from './CanvasToolbar';

interface PipelineCanvasProps {
  onNodeSelect: (node: Node | null) => void;
  onSelectionChange?: (nodes: Node[], edges?: Edge[]) => void;
  mode?: CanvasMode;
}

const PipelineCanvas: React.FC<PipelineCanvasProps> = ({ onNodeSelect, onSelectionChange: onSelectionChangeProp, mode = 'select' }) => {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    canvasBackground,
    canvasBackgroundColor,
    edgeStyle,
    toggleStageExpand,
    addTaskNode,
    addNode,
    removeNode,
    undo,
    redo,
    canUndo: checkCanUndo,
    canRedo: checkCanRedo,
  } = usePipelineStore();
  const [nodes, setNodesState, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(storeEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);
  const [zoom, setZoom] = useState(100);

  // Map canvas background setting to ReactFlow variant
  const backgroundVariant = useMemo(() => {
    switch (canvasBackground) {
      case 'dots':
        return BackgroundVariant.Dots;
      case 'lines':
        return BackgroundVariant.Lines;
      case 'grid':
        return BackgroundVariant.Cross;
      case 'none':
        return null;
      default:
        return BackgroundVariant.Dots;
    }
  }, [canvasBackground]);

  // Define custom node types
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      stageNode: StageNode,
      taskNode: TaskNode,
    }),
    []
  );

  // Keep track of user-dragged positions
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Update position tracking when nodes change from dragging
  React.useEffect(() => {
    nodes.forEach((node) => {
      if (node.position) {
        positionsRef.current.set(node.id, node.position);
      }
    });
  }, [nodes]);

  // Sync local state with store and add toggle handlers
  React.useEffect(() => {
    const nodesWithHandlers = storeNodes.map((node) => {
      // Preserve user-dragged positions
      const savedPosition = positionsRef.current.get(node.id);
      const position = savedPosition || node.position;

      if (node.type === 'stageNode') {
        return {
          ...node,
          position,
          data: {
            ...node.data,
            onToggleExpand: () => toggleStageExpand(node.id),
          },
        };
      }
      // Hide task nodes if parent stage is collapsed
      if (node.type === 'taskNode' && node.parentId) {
        const parentNode = storeNodes.find((n) => n.id === node.parentId);
        const isParentExpanded = parentNode?.data?.isExpanded ?? true;
        return {
          ...node,
          position,
          hidden: !isParentExpanded,
        };
      }
      return {
        ...node,
        position,
      };
    });
    setNodesState(nodesWithHandlers);
  }, [storeNodes, toggleStageExpand]);

  React.useEffect(() => {
    setEdgesState(storeEdges);
  }, [storeEdges]);

  // Auto-fit view when pipeline nodes are loaded from the agent (multiple nodes at once)
  const prevNodeCountRef = useRef(0);
  React.useEffect(() => {
    const addedCount = storeNodes.length - prevNodeCountRef.current;
    if (reactFlowInstance && addedCount > 1 && prevNodeCountRef.current === 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.3 });
      }, 100);
    }
    prevNodeCountRef.current = storeNodes.length;
  }, [storeNodes.length, reactFlowInstance]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edgeProps: any = {
        ...params,
        type: 'smoothstep',
      };
      if (edgeStyle === 'animated') {
        edgeProps.animated = true;
      } else if (edgeStyle === 'dashed') {
        edgeProps.style = { strokeDasharray: '5 5' };
      } else if (edgeStyle === 'solid') {
        edgeProps.type = 'default';
      }
      setEdgesState((eds) => addEdge(edgeProps, eds));
    },
    [setEdgesState, edgeStyle]
  );

  // Handle node changes from ReactFlow (drag, delete, etc.)
  const handleNodesChange = useCallback(
    (changes: any) => {
      // Check if any nodes are being removed
      const removeChanges = changes.filter((change: any) => change.type === 'remove');

      if (removeChanges.length > 0) {
        // Sync removals to store
        removeChanges.forEach((change: any) => {
          removeNode(change.id);
        });
      }

      // Apply all changes to local ReactFlow state
      onNodesChange(changes);
    },
    [onNodesChange, removeNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data || !reactFlowInstance) return;

      const { type, label, color, category } = JSON.parse(data);

      if (category === 'stage') {
        // Use project to convert screen coordinates to flow coordinates
        const position = reactFlowInstance.project({
          x: event.clientX,
          y: event.clientY,
        });

        // Create a new stage node
        const newNode: Node = {
          id: `${type}-${Date.now()}`,
          type: 'stageNode',
          position,
          style: { width: 220 },
          data: {
            label,
            stageType: type,
            stageName: 'Unnamed Stage',
            color,
            tasks: [],
            isExpanded: true,
            taskCount: 0,
          },
        };

        // Add to store, not just local state
        addNode(newNode);
      } else if (category === 'task') {
        // Find stage node under cursor
        const stageElements = document.querySelectorAll('[data-id]');
        let targetStageId: string | null = null;

        stageElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const nodeId = element.getAttribute('data-id');
          const node = storeNodes.find((n) => n.id === nodeId);

          if (
            node &&
            node.type === 'stageNode' &&
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
          ) {
            targetStageId = nodeId;
          }
        });

        if (targetStageId) {
          // Add task as child of the stage
          addTaskNode(targetStageId, {
            name: label,
            type: type,
            commands: [],
          });
        }
      }
    },
    [reactFlowInstance, setNodesState, addTaskNode, storeNodes]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node);
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      // Always pass all selected nodes and edges to parent
      onSelectionChangeProp?.(selectedNodes, selectedEdges);
      
      // For ConfigPanel, only show when single node selected
      if (selectedNodes.length === 1) {
        onNodeSelect(selectedNodes[0]);
      } else {
        onNodeSelect(null);
      }
    },
    [onNodeSelect, onSelectionChangeProp]
  );

  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);

  // Track zoom changes
  const handleMove = useCallback((_event: any, viewport: any) => {
    setZoom(Math.round(viewport.zoom * 100));
  }, []);

  // Keyboard shortcuts for undo/redo
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (checkCanUndo()) {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        if (checkCanRedo()) {
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, checkCanUndo, checkCanRedo]);

  return (
    <div
      className="pipeline-canvas"
      ref={reactFlowWrapper}
      style={{ cursor: mode === 'hand' ? 'grab' : 'default' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={(instance) => {
          setReactFlowInstance(instance);
          setZoom(100);
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onSelectionChange={handleSelectionChange}
        onMove={handleMove}
        panOnDrag={mode === 'hand' ? true : [1, 2]}
        nodesDraggable={true}
        selectionOnDrag={mode === 'select'}
        selectionMode={'partial' as any}
        multiSelectionKeyCode="Control"
        panOnScroll={false}
        zoomOnScroll={true}
        minZoom={0.2}
        maxZoom={2}
        fitView={false}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        nodeOrigin={[0, 0]}
        deleteKeyCode={null}
        style={{ backgroundColor: canvasBackgroundColor }}
      >
        {backgroundVariant && (
          <Background
            variant={backgroundVariant}
            color={canvasBackgroundColor === '#1e1e1e' ? '#4a4a4a' : '#d1d5db'}
            gap={16}
            size={1}
          />
        )}
      </ReactFlow>

      {/* Custom Controls */}
      <div className="custom-controls">
        <button
          className="control-btn"
          onClick={handleZoomOut}
          data-tooltip="Zoom Out"
          disabled={zoom <= 20}
          aria-label="Zoom Out"
        >
          <Minus size={14} />
        </button>
        <div className="zoom-display">{zoom}%</div>
        <button
          className="control-btn"
          onClick={handleZoomIn}
          data-tooltip="Zoom In"
          disabled={zoom >= 200}
          aria-label="Zoom In"
        >
          <Plus size={14} />
        </button>
        <div className="control-divider"></div>
        <button
          className="control-btn"
          onClick={handleFitView}
          data-tooltip="Fit View"
          aria-label="Fit View"
        >
          <Maximize2 size={14} />
        </button>
        <div className="control-divider"></div>
        <button
          className="control-btn"
          onClick={undo}
          data-tooltip="Undo (Ctrl+Z)"
          disabled={!checkCanUndo()}
          aria-label="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          className="control-btn"
          onClick={redo}
          data-tooltip="Redo (Ctrl+Y)"
          disabled={!checkCanRedo()}
          aria-label="Redo"
        >
          <Redo2 size={14} />
        </button>
      </div>
    </div>
  );
};

const PipelineCanvasWrapper: React.FC<PipelineCanvasProps> = (props) => (
  <ReactFlowProvider>
    <PipelineCanvas {...props} />
  </ReactFlowProvider>
);

export default PipelineCanvasWrapper;
