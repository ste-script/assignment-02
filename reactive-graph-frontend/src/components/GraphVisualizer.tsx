import React, { useState, useEffect } from "react";
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from "@react-sigma/core";
import { useLayoutForceAtlas2 } from "@react-sigma/layout-forceatlas2";
import Graph from "graphology";

interface GraphVisualizerProps {}
interface GraphData {
  nodes: { id: string }[];
  links: { source: string; target: string }[];
}
interface SseMessage {
  type: "update" | "error" | "complete";
  payload: GraphData | { message: string };
}

const LoadGraphologyGraph: React.FC<{ graphData: GraphData }> = ({ graphData }) => {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();
  const { start, stop } = useLayoutForceAtlas2({ settings: { slowDown: 10 } });

  useEffect(() => {
    const graph = new Graph({ multi: true, type: "directed" });

    graphData.nodes.forEach((node) => {
      if (!graph.hasNode(node.id)) {
        graph.addNode(node.id, { label: node.id, x: Math.random(), y: Math.random(), size: 5 });
      }
    });
    graphData.links.forEach((link, index) => {
      const edgeKey = `${link.source}->${link.target}_${index}`;
      if (!graph.hasEdge(edgeKey) && graph.hasNode(link.source) && graph.hasNode(link.target)) {
        graph.addEdgeWithKey(edgeKey, link.source, link.target, { size: 1 });
      }
    });

    loadGraph(graph);

    start();
    const timeoutId = setTimeout(() => stop(), 3000);

    registerEvents({
      clickNode: (event) => console.log("Node clicked:", event.node),
    });

    return () => {
      stop();
      clearTimeout(timeoutId);
    };
  }, [graphData, loadGraph, registerEvents, start, stop]);

  return null;
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = () => {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverSentError, setServerSentError] = useState<boolean>(false);

  useEffect(() => {
    if (isComplete || serverSentError) {
      console.log("Skipping SSE connection setup (already complete or errored).");
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
          if ("nodes" in messageData.payload && "links" in messageData.payload) {
            setData(messageData.payload as GraphData);
          } else {
            console.warn("Received update message with unexpected payload:", messageData.payload);
          }
        } else {
          console.log("Received non-update message or message without payload:", messageData);
        }
      } catch (e) {
        console.error("Failed to parse SSE message data:", event.data, e);
        setError("Failed to process update from server.");
      }
    };

    eventSource.addEventListener("error", (event: MessageEvent) => {
      setServerSentError(true);
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
    });

    eventSource.addEventListener("complete", (event: MessageEvent) => {
      console.log("Received complete event from server:", event.data);
      setIsComplete(true);
    });

    eventSource.onerror = (err) => {
      if (eventSource.readyState === EventSource.CLOSED) {
        if (isComplete || serverSentError) {
          console.log(`SSE connection closed by server (Complete: ${isComplete}, ServerError: ${serverSentError}).`);
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

    return () => {
      console.log("Cleaning up SSE connection.");
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
  }, [isComplete, serverSentError]);

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
    <div style={{ width: "90vw", height: "80vh", position: "relative", border: "1px solid #eee" }}>
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

      <SigmaContainer
        style={{ height: "100%", width: "100%" }}
        settings={{
          allowInvalidContainer: true,
          renderEdgeLabels: false,
          defaultNodeType: "circle",
          defaultEdgeType: "arrow",
        }}
      >
        <LoadGraphologyGraph graphData={data} />
      </SigmaContainer>
    </div>
  );
};

export default GraphVisualizer;
