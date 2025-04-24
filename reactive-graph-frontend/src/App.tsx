import React from "react";
import GraphVisualizer from "./components/GraphVisualizer";

function App() {
  // Replace with your actual API endpoint URL
  const apiUrl = "http://localhost:3001/"; // Example URL

  return (
    <div className="App">
      <h1>Reactive Graph</h1>
      <GraphVisualizer />
    </div>
  );
}

export default App;
