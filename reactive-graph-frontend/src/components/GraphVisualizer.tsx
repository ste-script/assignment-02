import React, { useRef } from 'react'; // Removed useEffect
import { Graph } from 'react-d3-graph';

interface GraphVisualizerProps {
  data: {
    nodes: { id: string }[];
    links: { source: string; target: string }[];
  };
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data }) => {
  const graphRef = useRef<any>(null);

  const config = {
    // Make graph responsive
    width: window.innerWidth * 0.9, // Use 90% of window width
    height: window.innerHeight * 0.8, // Use 80% of window height
    automaticRearrangeAfterDropNode: true,
    collapsible: true, // Allows collapsing/expanding nodes if hierarchy exists (might not apply directly here)
    directed: true, // Show arrows for links
    focusAnimationDuration: 0.75,
    highlightDegree: 1, // Highlight direct neighbors on hover
    highlightOpacity: 0.2,
    linkHighlightBehavior: true,
    nodeHighlightBehavior: true,
    panAndZoom: true, // Enable panning and zooming
    staticGraphWithDragAndDrop: false, // Allow physics simulation
    node: {
      color: '#3498db', // A slightly different blue
      size: 200, // Smaller nodes might look cleaner for large graphs
      highlightStrokeColor: '#2980b9',
      highlightFontSize: 12,
      highlightFontWeight: 'bold',
      labelProperty: 'id', // Display the node ID as a label
      fontSize: 8, // Smaller font size for labels
      renderLabel: true, // Ensure labels are rendered
      strokeColor: 'none', // Remove node border
      symbolType: 'circle', // Explicitly set symbol type
    },
    link: {
      color: '#bdc3c7', // Lighter grey for links
      highlightColor: '#2c3e50', // Darker highlight for links
      renderLabel: false, // Don't render link labels by default
      strokeWidth: 1.5, // Slightly thicker links
      markerHeight: 6,
      markerWidth: 6,
      type: 'STRAIGHT', // Use straight lines for links
    },
    d3: {
      // Fine-tune the force simulation
      alphaTarget: 0.05, // Keep simulation running slightly longer
      gravity: -200, // Increase repulsion between nodes (negative value)
      linkLength: 100, // Desired link distance
      linkStrength: 0.5, // Strength of the link force
      disableLinkForce: false,
    },
  };

  // Ensure data always has nodes and links arrays, even if empty
  const graphData = data || { nodes: [], links: [] };

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return <div>Loading graph or no data available...</div>;
  }

  return (
    <div>
      <Graph
        id="dependency-graph" // More descriptive ID
        data={graphData}
        config={config}
        ref={graphRef}
      />
    </div>
  );
};

export default GraphVisualizer;