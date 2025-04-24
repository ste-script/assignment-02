var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var app = express();
var javaDepsLibrary = require("../src/async.mjs");
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

app.use("/", async function (req, res) {
  const rawDeps = await javaDepsLibrary.getProjectDependencies(
    path.join(
      "..",
      "resources",
      "assignment-01",
      "src",
      "main",
      "java",
      "pcd",
      "ass01",
      "Controller"
    )
  );

  // Transform data for react-d3-graph
  const nodes = [];
  const links = [];
  const nodeIds = new Set();
  const linkIds = new Set(); // Keep track of unique links

  if (rawDeps && rawDeps.packageReports) {
    rawDeps.packageReports.forEach((pkg) => {
      const currentPackageName = pkg.packageName;
      if (pkg.classReports) {
        pkg.classReports.forEach((cls) => {
          // Skip package-info classes for cleaner graph if desired
          if (cls.className === "package-info") {
            return;
          }

          const sourceNodeId = `${currentPackageName}.${cls.className}`;

          // Add source node if it doesn't exist
          if (!nodeIds.has(sourceNodeId)) {
            nodes.push({ id: sourceNodeId });
            nodeIds.add(sourceNodeId);
          }

          if (cls.usedTypes) {
            cls.usedTypes.forEach((usedType) => {
              // Ensure package and type are defined to avoid "undefined.undefined" IDs
              if (!usedType.package || !usedType.type) {
                console.warn(
                  "Skipping usedType with missing package or type:",
                  usedType,
                  "for class:",
                  sourceNodeId
                );
                return;
              }
              const targetNodeId = `${usedType.package}.${usedType.type}`;

              // Add target node if it doesn't exist
              if (!nodeIds.has(targetNodeId)) {
                nodes.push({ id: targetNodeId });
                nodeIds.add(targetNodeId);
              }

              // Create a unique identifier for the link
              const linkId = `${sourceNodeId}->${targetNodeId}`;

              // Add link only if it's unique
              if (!linkIds.has(linkId)) {
                links.push({ source: sourceNodeId, target: targetNodeId });
                linkIds.add(linkId);
              }
            });
          }
        });
      }
    });
  }

  const graphData = { nodes, links };
  res.json(graphData); // Send the transformed data
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
