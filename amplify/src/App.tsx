import { useState } from 'react';
import PipelineCanvas from './components/canvas/PipelineCanvas';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import ConfigPanel from './components/panels/ConfigPanel';
import './App.css';
import { Node } from 'reactflow';

function App() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <div className="app">
      <Header />
      <div className="app-content">
        <Sidebar />
        <PipelineCanvas onNodeSelect={setSelectedNode} />
        <ConfigPanel selectedNode={selectedNode} />
      </div>
    </div>
  );
}

export default App;
