var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var app = express();
var javaDepsLibrary = require("../src/reactive.mjs");
var path = require("path");
// view engine setup
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
//disable cors
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Add the new SSE handler
let currentProjectPath = null;

app.post("/scan", function (req, res) {
  const projectPath = req.body.folderPath;

  if (!projectPath) {
    return res.status(400).json({ error: "Folder path is required." });
  }

  console.log(`Starting scan for folder: ${projectPath}`);
  currentProjectPath = projectPath; // Salva il percorso per l'uso nell'endpoint SSE
  res.status(200).json({ message: "Scan started successfully." });
});

app.get("/updates", function (req, res) {
  if (!currentProjectPath) {
    res.status(400).json({ error: "No scan in progress." });
    return;
  }

  console.log(`Sending updates for folder: ${currentProjectPath}`);

  // Imposta le intestazioni per SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Invia un messaggio iniziale per mantenere viva la connessione
  res.write(`data: ${JSON.stringify({ message: "Connection established" })}\n\n`);

  // --- Data structures to hold the graph state ---
  const nodes = [];
  const links = [];
  const nodeIds = new Set();
  const linkIds = new Set();

  // --- Function to send updates to the client ---
  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // --- Subscribe to the observable ---
  const dependencySubscription = javaDepsLibrary
    .getProjectDependenciesRx(currentProjectPath)
    .subscribe({
      next: (reportItem) => {
        let itemProcessed = false;

        reportItem.className = reportItem.className
          .replace(currentProjectPath.split("/").join("."), "")
          .replace(/[\\/]/g, ".")
          .slice(1);

        if (reportItem && reportItem.className) {
          if (reportItem.className === "package-info") {
            return;
          }

          const sourceNodeId = reportItem.className;

          if (!nodeIds.has(sourceNodeId)) {
            const newNode = { id: sourceNodeId };
            nodes.push(newNode);
            nodeIds.add(sourceNodeId);
            itemProcessed = true;
          }

          if (reportItem.usedTypes) {
            reportItem.usedTypes.forEach((usedTypeString) => {
              let targetNodeId = usedTypeString;

              if (!nodeIds.has(targetNodeId)) {
                const newNode = { id: targetNodeId };
                nodes.push(newNode);
                nodeIds.add(targetNodeId);
                itemProcessed = true;
              }

              const linkId = `${sourceNodeId}->${targetNodeId}`;
              if (!linkIds.has(linkId) && sourceNodeId !== targetNodeId) {
                const newLink = { source: sourceNodeId, target: targetNodeId };
                links.push(newLink);
                linkIds.add(linkId);
                itemProcessed = true;
              }
            });
          }
        } else {
          console.warn("Received unexpected item from observable:", reportItem);
        }

        if (itemProcessed) {
          const currentGraphData = { nodes: [...nodes], links: [...links] };
          sendUpdate({ type: "update", payload: currentGraphData });
        }
      },
      error: (err) => {
        console.error("Error in dependency stream:", err);
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Error processing dependencies." })}\n\n`);
        res.end();
      },
      complete: () => {
        console.log("Dependency stream completed.");
        res.write(`event: complete\ndata: ${JSON.stringify({ message: "Analysis complete." })}\n\n`);
        res.end();
      },
    });

  req.on("close", () => {
    console.log("Client disconnected.");
    dependencySubscription.unsubscribe();
  });
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
