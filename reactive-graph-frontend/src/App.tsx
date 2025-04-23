import React from 'react';
import GraphVisualizer from './components/GraphVisualizer';
import { useGraphData } from './hooks/useGraphData';

const App: React.FC = () => {
  const { data, loading, error } = useGraphData();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error loading graph data: {error.message}</div>;
  }

  return (
    <div>
      <h1>Graph Visualization</h1>
      <GraphVisualizer data={data} />
    </div>
  );
};

export default App;