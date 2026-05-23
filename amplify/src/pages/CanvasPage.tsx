import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import PipelineCanvas from '../components/canvas/PipelineCanvas';
import ConfigPanel from '../components/panels/ConfigPanel';
import { Node } from 'reactflow';
import { usePipelineStore } from '../store/pipelineStore';

const CanvasPage: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const { nodes, edges, updatePipelineName } = usePipelineStore();

  useEffect(() => {
    // Check if there's an imported pipeline
    const importedData = localStorage.getItem('flow-imported-pipeline');
    if (importedData) {
      try {
        const data = JSON.parse(importedData);
        if (data.name) updatePipelineName(data.name);
        // Note: nodes and edges would be loaded here if we implement full import
        localStorage.removeItem('flow-imported-pipeline');
      } catch (error) {
        console.error('Error loading imported pipeline:', error);
      }
    }

    // Auto-save to localStorage
    const saveInterval = setInterval(() => {
      const state = usePipelineStore.getState();
      localStorage.setItem(
        'flow-autosave',
        JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          name: state.currentPipeline?.name,
          lastSaved: new Date().toISOString(),
        })
      );
    }, 5000); // Auto-save every 5 seconds

    return () => clearInterval(saveInterval);
  }, [updatePipelineName]);

  return (
    <div className="app">
      <Header />
      <div className="app-content">
        <Sidebar />
        <PipelineCanvas onNodeSelect={setSelectedNode} />
        {selectedNode && <ConfigPanel selectedNode={selectedNode} />}
      </div>
    </div>
  );
};

export default CanvasPage;
