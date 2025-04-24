import { useEffect, useState } from 'react';

// Define a basic structure for the graph data expected by react-d3-graph
interface GraphData {
  nodes: any[];
  links: any[];
}

const initialGraphData: GraphData = { nodes: [], links: [] };

export const useGraphData = (url: string) => {
  // Initialize state with the default graph structure
  const [data, setData] = useState<GraphData>(initialGraphData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Reset state on new fetch attempt (optional, but good practice)
      setLoading(true);
      setError(null);
      // Keep initial data structure while loading new data
      // setData(initialGraphData); 
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Network response was not ok (status: ${response.status})`);
        }
        const result = await response.json();
        // Ensure the fetched data has the required structure
        if (result && Array.isArray(result.nodes) && Array.isArray(result.links)) {
          setData(result);
        } else {
          // Set back to initial state or throw an error if data format is invalid
          setData(initialGraphData); 
          throw new Error('Fetched data does not have the required nodes and links arrays.');
        }
      } catch (err) {
        // Use type assertion or check if err is an instance of Error
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unknown error occurred');
        }
         // Optionally reset data to initial state on error
        setData(initialGraphData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
};
