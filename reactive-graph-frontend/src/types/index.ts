export type GraphNode = {
  id: string;
  label: string;
  data?: Record<string, any>;
};

export type GraphEdge = {
  source: string;
  target: string;
  label?: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export interface GraphVisualizerProps {
  data: GraphData;
  width?: number;
  height?: number;
}