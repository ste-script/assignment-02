import React, { useRef, useState, useEffect } from "react"; // Import useState, useEffect
import { Graph } from "react-d3-graph";

interface GraphVisualizerProps {
  // Remove the data prop if it's fetched internally
  // data: {
  //   nodes: { id: string }[];
  //   links: { source: string; target: string }[];
  // };
}

// Define a type for the expected data structure
interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string }[];
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = () => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div
  // Initialize with default dimensions or null/0
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [data, setData] = useState<GraphData | null>(null); // Use the GraphData type and initialize to null
  const [error, setError] = useState<string | null>(null); // State for error handling

  // Effect to fetch data
  useEffect(() => {
    const fetchData = async () => {
      setError(null); // Reset error state
      try {
        const response = await fetch("http://localhost:3001"); // Fetch from the specified URL
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedData: GraphData = await response.json();
        setData(fetchedData); // Update state with fetched data
      } catch (e: any) {
        console.error("Failed to fetch graph data:", e);
        setError(`Failed to load graph data: ${e.message}`); // Set error state
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures this runs once on mount

  // Effect to update dimensions on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        // Use container dimensions
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        // Only update if dimensions are valid
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    // Set initial size
    // Use setTimeout to allow the container to render and get dimensions
    const timeoutId = setTimeout(updateSize, 0);

    // Add resize listener
    window.addEventListener("resize", updateSize);

    // Cleanup listener and timeout
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateSize);
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  const config = {
    // Use state for dimensions
    width: dimensions.width,
    height: dimensions.height,
    automaticRearrangeAfterDropNode: true,
    collapsible: true,
    directed: false,
    focusAnimationDuration: 0.75,
    highlightDegree: 1,
    highlightOpacity: 0.2,
    linkHighlightBehavior: true,
    nodeHighlightBehavior: true,
    panAndZoom: true, // Keep enabled, but ensure dimensions are valid first
    staticGraphWithDragAndDrop: false,
    node: {
      color: "#3498db",
      size: 200,
      highlightStrokeColor: "#2980b9",
      highlightFontSize: 12,
      highlightFontWeight: "bold",
      labelProperty: "id",
      fontSize: 8,
      renderLabel: true,
      strokeColor: "none",
      symbolType: "circle",
    },
    link: {
      color: "#bdc3c7",
      highlightColor: "#2c3e50",
      renderLabel: false,
      strokeWidth: 1.5,
      markerHeight: 6,
      markerWidth: 6,
      type: "STRAIGHT",
    },
    d3: {
      alphaTarget: 0.05,
      linkLength: 100,
      linkStrength: 0.5,
    },
  };

  const graphData = data || { nodes: [], links: [] };

  // Render loading state until dimensions are calculated (> 0) and data is present
  // Also check for errors
  const isLoading = !data || dimensions.width <= 0 || dimensions.height <= 0;

  return (
    // Ensure the container div takes up space for dimension calculation
    // Use relative units or ensure parent has height
    <div
      ref={containerRef}
      style={{ width: "90vw", height: "80vh", border: "1px solid transparent" }}
    >
      {" "}
      {/* Added transparent border to potentially help layout calculation */}
      {error ? ( // Display error if fetch failed
        <div>Error: {error}</div>
      ) : isLoading ? (
        <div>Loading graph or calculating dimensions...</div>
      ) : (
        <Graph
          id="dependency-graph"
          // Add a key that changes when dimensions change to force re-mount
          key={`${dimensions.width}-${dimensions.height}`}
          data={graphData}
          config={config}
          ref={graphRef}
        />
      )}
    </div>
  );
};

export default GraphVisualizer;
