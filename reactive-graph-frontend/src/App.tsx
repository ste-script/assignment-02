import React, { useState } from "react";
import GraphVisualizer from "./components/GraphVisualizer";
import { GraphData } from "./types";

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const path = event.target.value;
    console.log("Entered folder path:", path);
    setFolderPath(path);
  };

  const handleScan = async () => {
    if (folderPath) {
      if (!folderPath.match(/^[a-zA-Z]:\\|^\//)) {
        alert("Please enter a valid absolute path (e.g., C:\\path\\to\\folder or /path/to/folder).");
        return;
      }

      try {
        const response = await fetch("http://localhost:3001/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ folderPath }),
        });

        if (response.ok) {
          console.log("Scan started successfully");
          startListeningToUpdates();
        } else {
          const error = await response.json();
          alert(`Error: ${error.error}`);
        }
      } catch (error) {
        console.error("Error during scan:", error);
        alert("An error occurred while scanning the folder.");
      }
    } else {
      alert("You must enter a folder path before pressing the \"Scan\" button.");
    }
  };

  const startListeningToUpdates = () => {
    const eventSource = new EventSource("http://localhost:3001/updates");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Received update:", data);

      if (data.type === "update" && data.payload) {
        setGraphData(data.payload as GraphData);
      }
    };

    eventSource.onerror = (error) => {
      console.error("Error in EventSource:", error);
      eventSource.close();
    };
  };

  return (
    <div className="App">
      <h1>Reactive Graph</h1>
      <div>
        <label>
          Enter the absolute path of the folder to scan:
          <input
            type="text"
            placeholder="C:\\path\\to\\your\\folder"
            onChange={handleInputChange}
          />
        </label>
        <button onClick={handleScan}>Scan</button>
      </div>
      <GraphVisualizer data={graphData} />
    </div>
  );
}

export default App;