import React from 'react';
import { useGraphData } from './hooks/useGraphData';
import GraphVisualizer from './components/GraphVisualizer';

function App() {
  // Replace with your actual API endpoint URL
  const apiUrl = 'http://localhost:3001/'; // Example URL
  const { data, loading, error } = useGraphData(apiUrl);

  return (
    <div className="App">
      <h1>Reactive Graph</h1>
      {loading && <div>Loading graph data...</div>}
      {error && <div style={{ color: 'red' }}>Error loading graph data: {error}</div>}
      {/* Only render GraphVisualizer when not loading, no error, and data is available */}
      {!loading && !error && data && (
        <GraphVisualizer data={data} />
      )}
      {/* You might still want to show the message from GraphVisualizer if data exists but nodes are empty */}
      {!loading && !error && data && data.nodes.length === 0 && (
         <div>No nodes to display.</div>
      )}
    </div>
  );
}

export default App;