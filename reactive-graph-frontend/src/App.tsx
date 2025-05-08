import React, { useState } from "react";
import GraphVisualizer from "./components/GraphVisualizer";

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);

  const handleFolderSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const folder = event.target.files[0].webkitRelativePath.split("/")[0];
      setFolderPath(folder);
    }
  };

  const handleScan = () => {
    if (folderPath) {
      console.log(`Scanning folder: ${folderPath}`);
      // Qui puoi aggiungere la logica per inviare il percorso al backend o eseguire altre azioni
    } else {
      alert("Select a folder containing a java project, before pressing the \"Scan\" button.");
    }
  };

  return (
    <div className="App">
      <h1>Reactive Graph</h1>
      <div>
        <label>
          Select a folder to scan:
          <input
            type="file"
            webkitdirectory="true"
            directory="true"
            onChange={handleFolderSelect}
          />
        </label>
        <button onClick={handleScan}>Scan</button>
      </div>
      <GraphVisualizer />
    </div>
  );
}

export default App;
