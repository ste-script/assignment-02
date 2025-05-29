import React, { useEffect, useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";

cytoscape.use(coseBilkent);

interface GraphVisualizerProps {
  data: {
    nodes: { id: string }[];
    links: { source: string; target: string }[];
  };
}

const convertToCytoscapeElements = (graphData: GraphVisualizerProps["data"]) => {
  const nodes = graphData.nodes.map((node) => ({
    data: { id: node.id, label: node.id },
  }));
  const edges = graphData.links.map((link) => ({
    data: {
      source: link.source,
      target: link.target,
    },
  }));
  return [...nodes, ...edges];
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data }) => {
  const cyRef = useRef<cytoscape.Core | null>(null);

  const elements = React.useMemo(() => convertToCytoscapeElements(data), [data]);

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const layout = cyRef.current.layout({
        name: "cose-bilkent",
        nodeDimensionsIncludeLabels: true,
        animate: false,
      });
      layout.run();
    }
  }, [elements]);

  return (
    <div
      style={{
        width: "90vw",
        height: "80vh",
        position: "relative",
        border: "1px solid #eee",
      }}
    >
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
      />
    </div>
  );
};

export default GraphVisualizer;