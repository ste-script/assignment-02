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
app.get("/", function (req, res) {
  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Flush the headers to establish the connection

  const projectPath = path.join(
    "..",
    "resources",
    "assignment-01",
    "src",
    "main",
    "java",
    "pcd",
    "ass01",
    "Controller" // Assuming this is the entry point or directory
  );

  // --- Data structures to hold the graph state ---
  const nodes = [];
  const links = [];
  const nodeIds = new Set();
  const linkIds = new Set(); // Keep track of unique links

  // --- Function to send updates to the client ---
  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // --- Subscribe to the observable ---
  // Assuming getProjectDependenciesRx returns an Observable that emits
  // individual class reports or similar granular data.
  // You might need to adjust the processing logic based on what exactly it emits.
  const dependencySubscription = javaDepsLibrary
    .getProjectDependenciesRx(projectPath) // Assuming this returns an Observable<ClassReport | PackageReport | etc.>
    .subscribe({
      next: (reportItem) => {
        // --- Process each emitted item incrementally ---
        // This logic assumes reportItem is structured similarly to how
        // you processed cls and pkg before, but emitted one by one.
        // Adjust based on the actual structure emitted by the observable.

        let itemProcessed = false; // Flag to check if we added anything

        // Example: Assuming it emits class reports directly
        if (reportItem && reportItem.className && reportItem.packageName) {
           // Skip package-info classes
           if (reportItem.className === "package-info") {
             return;
           }

           const currentPackageName = reportItem.packageName;
           const sourceNodeId = `${currentPackageName}.${reportItem.className}`;

           // Add source node if new
           if (!nodeIds.has(sourceNodeId)) {
             const newNode = { id: sourceNodeId };
             nodes.push(newNode);
             nodeIds.add(sourceNodeId);
             itemProcessed = true;
             // Optional: Send just the new node
             // sendUpdate({ type: 'add_node', payload: newNode });
           }

           if (reportItem.usedTypes) {
             reportItem.usedTypes.forEach((usedType) => {
               if (!usedType.package || !usedType.type) {
                 console.warn(/* ... */);
                 return;
               }
               const targetNodeId = `${usedType.package}.${usedType.type}`;

               // Add target node if new
               if (!nodeIds.has(targetNodeId)) {
                 const newNode = { id: targetNodeId };
                 nodes.push(newNode);
                 nodeIds.add(targetNodeId);
                 itemProcessed = true;
                 // Optional: Send just the new node
                 // sendUpdate({ type: 'add_node', payload: newNode });
               }

               // Add link if new
               const linkId = `${sourceNodeId}->${targetNodeId}`;
               if (!linkIds.has(linkId)) {
                 const newLink = { source: sourceNodeId, target: targetNodeId };
                 links.push(newLink);
                 linkIds.add(linkId);
                 itemProcessed = true;
                 // Optional: Send just the new link
                 // sendUpdate({ type: 'add_link', payload: newLink });
               }
             });
           }
        } else {
             console.warn("Received unexpected item from observable:", reportItem);
        }


        // --- Send the current full graph state on each update ---
        // This is simpler for the client to handle than deltas.
        if (itemProcessed) {
            const currentGraphData = { nodes: [...nodes], links: [...links] }; // Send copies
            sendUpdate({ type: 'update', payload: currentGraphData });
        }
      },
      error: (err) => {
        console.error("Error in dependency stream:", err);
        // Send an error event to the client
        res.write(`event: error\ndata: ${JSON.stringify({ message: "Error processing dependencies." })}\n\n`);
        res.end(); // Close the connection on error
      },
      complete: () => {
        console.log("Dependency stream completed.");
        // Send a completion event to the client
        res.write(`event: complete\ndata: ${JSON.stringify({ message: "Analysis complete." })}\n\n`);
        res.end(); // Close the connection when the observable completes
      },
    });

  // --- Handle client disconnect ---
  req.on("close", () => {
    console.log("Client disconnected.");
    dependencySubscription.unsubscribe(); // Clean up the subscription
  });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
