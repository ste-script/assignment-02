import React, { useRef, useState, useEffect } from "react";
import { Graph } from "react-d3-graph";

interface GraphVisualizerProps {}

// Define a type for the expected data structure from SSE payload
interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string }[];
}

// Define a type for the SSE message structure
interface SseMessage {
  type: "update" | "error" | "complete"; // Add other types if needed
  payload: GraphData | { message: string }; // Payload varies based on type
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = () => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] }); // Initialize with empty graph
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false); // Track if analysis is complete
  const [isConnected, setIsConnected] = useState<boolean>(false); // Track connection status
  const [serverSentError, setServerSentError] = useState<boolean>(false); // Track if server explicitly sent an error

  // Effect to setup SSE connection
  useEffect(() => {
    // --- Only establish connection if not complete and no server error ---
    // This prevents reconnecting after completion or server error
    if (isComplete || serverSentError) {
      console.log("Skipping SSE connection setup (already complete or errored).");
      return;
    }

    setError(null);
    // isComplete and serverSentError are reset by dependencies changing now
    setIsConnected(false);
    setData({ nodes: [], links: [] }); // Reset data on new connection attempt

    console.log("Setting up SSE connection...");
    const eventSource = new EventSource("http://localhost:3001"); // Connect to the SSE endpoint

    eventSource.onopen = () => {
      console.log("SSE connection opened.");
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const messageData: SseMessage = JSON.parse(event.data);

        if (messageData.type === "update" && messageData.payload) {
          if ("nodes" in messageData.payload && "links" in messageData.payload) {
            // Use functional update to avoid stale state issues if updates are rapid
            setData((currentData) => ({
              nodes: (messageData.payload as GraphData).nodes,
              links: (messageData.payload as GraphData).links,
            }));
          } else {
            console.warn(
              "Received update message with unexpected payload:",
              messageData.payload
            );
          }
        } else {
          console.log(
            "Received non-update message or message without payload:",
            messageData
          );
        }
      } catch (e) {
        console.error("Failed to parse SSE message data:", event.data, e);
        setError("Failed to process update from server.");
        // Consider closing connection on parsing error?
        // eventSource.close();
      }
    };

    // Listen for custom 'error' events from the server
    eventSource.addEventListener("error", (event: MessageEvent) => {
      setServerSentError(true); // Mark that server sent an error
      console.error("Received custom error event from server. Data:", event.data);
      let errorMessage = "Unknown server error.";
      if (event.data) {
        try {
          const errorData = JSON.parse(event.data);
          errorMessage = errorData.message || "Server error message missing.";
        } catch (e) {
          console.error("Failed to parse server error data:", event.data, e);
          errorMessage = "Received an unparsable error message from server.";
        }
      } else {
        errorMessage = "Server sent an error event without details.";
      }
      setError(`Server error: ${errorMessage}`);
      // Server should close the connection after sending this.
    });

    // Listen for custom 'complete' events from the server
    eventSource.addEventListener("complete", (event: MessageEvent) => {
      console.log("Received complete event from server:", event.data);
      setIsComplete(true); // State update triggers effect re-run due to dependency array
      // Server will close the connection after sending this.
    });

    // Handle general connection errors (e.g., server down, or closure)
    eventSource.onerror = (err) => {
      // This handler now has the correct 'isComplete' and 'serverSentError' values
      if (eventSource.readyState === EventSource.CLOSED) {
        if (isComplete || serverSentError) {
          console.log(
            `SSE connection closed by server (Complete: ${isComplete}, ServerError: ${serverSentError}).`
          );
        } else {
          console.error("EventSource connection closed unexpectedly:", err);
          setError("Connection to server lost or failed unexpectedly.");
          setIsConnected(false);
        }
      } else {
        console.error("EventSource encountered an unknown error:", err);
        setError("An unknown error occurred with the connection.");
        setIsConnected(false);
      }
    };

    // Cleanup: close the connection when the component unmounts OR dependencies change
    return () => {
      console.log("Cleaning up SSE connection.");
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
    // Add isComplete and serverSentError: Effect re-runs if they change.
    // The check at the top prevents reconnecting after completion/error.
  }, [isComplete, serverSentError]);

  // Effect to update dimensions on mount and resize (no changes needed here)
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };
    const timeoutId = setTimeout(updateSize, 0);
    window.addEventListener("resize", updateSize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const config = {
    // Use state for dimensions
    width: dimensions.width,
    height: dimensions.height,
    automaticRearrangeAfterDropNode: true,
    collapsible: true,
    directed: true, // Dependencies are usually directed
    focusAnimationDuration: 0.75,
    highlightDegree: 1,
    highlightOpacity: 0.2,
    linkHighlightBehavior: true,
    nodeHighlightBehavior: true,
    panAndZoom: true,
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
      alphaTarget: 0.05, // Lower target alpha for potentially less movement
      linkLength: 120, // Slightly increase link length
      linkStrength: 0.3, // Slightly decrease link strength
    },
  };

  // Determine loading/status message
  let statusMessage = "";
  if (error) {
    statusMessage = `Error: ${error}`;
  } else if (!isConnected && !isComplete) {
    statusMessage = "Connecting to analysis server...";
  } else if (isConnected && data.nodes.length === 0 && !isComplete) {
    statusMessage = "Connected. Waiting for dependency data...";
  } else if (isConnected && !isComplete) {
    statusMessage = "Analysis in progress..."; // Show this while receiving updates
  } else if (isComplete) {
    statusMessage = "Analysis complete.";
  }

  // Render graph only if dimensions are valid
  const canRenderGraph = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div
      ref={containerRef}
      style={{
        width: "90vw",
        height: "80vh",
        border: "1px solid #eee",
        position: "relative",
      }} // Added border, relative positioning
    >
      {/* Status Overlay */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          background: "rgba(255,255,255,0.8)",
          padding: "5px 10px",
          borderRadius: "4px",
          zIndex: 10,
        }}
      >
        {statusMessage}
      </div>

      {/* Render graph area */}
      {canRenderGraph ? (
        <Graph
          id="dependency-graph"
          key={`${dimensions.width}-${dimensions.height}`} // Re-mount on resize might be okay
          data={data} // Use the incrementally updated data
          config={config}
          ref={graphRef}
        />
      ) : (
        // Show only the status message if dimensions aren't ready
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          {statusMessage || "Calculating dimensions..."}
        </div>
      )}
    </div>
  );
};

export default GraphVisualizer;
