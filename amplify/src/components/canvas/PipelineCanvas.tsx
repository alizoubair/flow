import React, { useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  Node,
  Background,
  Controls,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { usePipelineStore } from '../../store/pipelineStore';
import StageNode from './nodes/StageNode';
import TaskNode from './nodes/TaskNode';
import './PipelineCanvas.css';


interface PipelineCanvasProps {
  onNodeSelect: (node: Node | null) => void;
}

const PipelineCanvas: React.FC<PipelineCanvasProps> = ({ onNodeSelect }) => {
  const { nodes: storeNodes, edges: storeEdges, toggleStageExpand, addTaskNode, addNode, removeNode } = usePipelineStore();
  const [nodes, setNodesState, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(storeEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = React.useState<any>(null);

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

  const onConnect = useCallback(
    (params: Connection) => setEdgesState((eds) => addEdge(params, eds)),
    [setEdgesState]
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

        console.log('Task drop - targetStageId:', targetStageId);
        console.log('Available stage nodes:', storeNodes.filter(n => n.type === 'stageNode'));

        if (targetStageId) {
          console.log('Adding task to stage:', targetStageId);
          // Add task as child of the stage
          addTaskNode(targetStageId, {
            name: label,
            type: type,
            commands: [],
          });
        } else {
          console.log('No stage found under cursor');
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

  return (
    <div className="pipeline-canvas" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultViewport={{ x: 250, y: 100, zoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        fitView={false}
        nodeOrigin={[0, 0]}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};

const PipelineCanvasWrapper: React.FC<PipelineCanvasProps> = (props) => (
  <ReactFlowProvider>
    <PipelineCanvas {...props} />
  </ReactFlowProvider>
);

export default PipelineCanvasWrapper;
