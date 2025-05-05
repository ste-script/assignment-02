import React, { useState, useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
// Consider using a layout extension like cose-bilkent for better layouts
// import coseBilkent from 'cytoscape-cose-bilkent';
// cytoscape.use(coseBilkent);

interface GraphVisualizerProps {}
interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string }[];
}
interface SseMessage {
  type: "update" | "error" | "complete";
  payload: GraphData | { message: string };
}

// Helper to convert GraphData to Cytoscape elements
const convertToCytoscapeElements = (graphData: GraphData) => {
  const nodes = graphData.nodes.map((node) => ({
    data: { id: node.id, label: node.id },
  }));
  const edges = graphData.links.map((link, index) => ({
    data: {
      source: link.source,
      target: link.target,
    },
  }));
  return [...nodes, ...edges];
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = () => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverSentError, setServerSentError] = useState<boolean>(false);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (isComplete || serverSentError) {
      console.log(
        "Skipping SSE connection setup (already complete or errored)."
      );
      return;
    }

    setError(null);
    setIsConnected(false);
    setData({ nodes: [], links: [] });

    console.log("Setting up SSE connection...");
    const eventSource = new EventSource("http://localhost:3001");

    eventSource.onopen = () => {
      console.log("SSE connection opened.");
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const messageData: SseMessage = JSON.parse(event.data);

        if (messageData.type === "update" && messageData.payload) {
          if (
            "nodes" in messageData.payload &&
            "links" in messageData.payload
          ) {
            setData(messageData.payload as GraphData);
          } else {
            console.warn(
              "Received update message with unexpected payload:",
              messageData.payload
            );
          }
        } else if (messageData.type === "complete") {
          console.log("Received complete message from server:", messageData);
          setIsComplete(true);
        } else if (messageData.type === "error") {
          console.error(
            "Received error message from server:",
            messageData.payload
          );
          if (
            typeof messageData.payload === "object" &&
            messageData.payload &&
            "message" in messageData.payload
          ) {
            setError(`Server error: ${messageData.payload.message}`);
          } else {
            setError("Received unknown server error structure.");
          }
          setServerSentError(true);
        } else {
          console.log(
            "Received non-update/complete/error message or message without payload:",
            messageData
          );
        }
      } catch (e) {
        console.error("Failed to parse SSE message data:", event.data, e);
        setError("Failed to process update from server.");
      }
    };

    eventSource.onerror = (err) => {
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

    eventSource.addEventListener("complete", (event: MessageEvent) => {
      console.log(
        "Received explicit 'complete' event from server:",
        event.data
      );
      setIsComplete(true);
    });

    eventSource.addEventListener("error", (event: MessageEvent) => {
      setServerSentError(true);
      console.error(
        "Received explicit 'error' event from server. Data:",
        event.data
      );
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
    });

    return () => {
      console.log("Cleaning up SSE connection.");
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
  }, [isComplete, serverSentError]);

  const elements = React.useMemo(
    () => convertToCytoscapeElements(data),
    [data]
  );

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const layout = cyRef.current.layout({
        name: "cose",
        animate: true,
        padding: 30,
        nodeRepulsion: () => 400000,
        idealEdgeLength: () => 100,
      });
      layout.run();
    }
  }, [elements]);

  let statusMessage = "";
  if (error) {
    statusMessage = `Error: ${error}`;
  } else if (!isConnected && !isComplete && !serverSentError) {
    statusMessage = "Connecting to analysis server...";
  } else if (isConnected && data.nodes.length === 0 && !isComplete && !error) {
    statusMessage = "Connected. Waiting for dependency data...";
  } else if (isConnected && !isComplete && !error) {
    statusMessage = "Analysis in progress...";
  } else if (isComplete) {
    statusMessage = "Analysis complete.";
  } else if (serverSentError) {
    statusMessage = `Error: ${error}`;
  }

  return (
    <div
      style={{
        width: "90vw",
        height: "80vh",
        position: "relative",
        border: "1px solid #eee",
      }}
    >
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

      <CytoscapeComponent
        elements={elements}
        style={{ width: "100%", height: "100%" }}
        cy={(cy) => {
          cyRef.current = cy;
          cy.removeListener("tap", "node");
          cy.on("tap", "node", (event) => {
            const node = event.target;
            console.log("Node clicked:", node.id());
          });
        }}
        layout={{ name: "preset" }}
      />
    </div>
  );
};

export default GraphVisualizer;
