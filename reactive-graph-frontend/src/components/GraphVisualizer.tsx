import React, { useEffect, useRef } from 'react';
import { Graph } from 'react-d3-graph'; // Assuming you're using a library like react-d3-graph for visualization

interface GraphVisualizerProps {
  data: {
    nodes: { id: string }[];
    links: { source: string; target: string }[];
  };
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data }) => {
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.updateGraph(data);
    }
  }, [data]);

  const config = {
    node: {
      color: 'lightblue',
      size: 200,
      highlightStrokeColor: 'blue',
    },
    link: {
      highlightColor: 'lightblue',
    },
  };

  return (
    <div>
      <Graph
        id="graph-id"
        data={data}
        config={config}
        ref={graphRef}
      />
    </div>
  );
};

export default GraphVisualizer;