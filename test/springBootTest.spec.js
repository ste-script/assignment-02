import path from "path";
import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
} from "../src/main.js";
import fs from "fs/promises";

const baseFolder = path.join("..", "testReport");

async function runTests(unique) {
  const compositeFolder = path.join(baseFolder, unique ? "unique" : "all");
  try {
    // Create directories if they don't exist
    await fs.mkdir(compositeFolder, { recursive: true });
    const classFilename = "classReport.json";
    const packageFilename = "packageReport.json";
    const projectFilename = "projectReport.json";

    // Test getClassDependencies
    const classReport = getClassDependencies(
      path.join(
        "..",
        "resources",
        "spring-boot",
        "spring-boot-project",
        "spring-boot",
        "src",
        "main",
        "java",
        "org",
        "springframework",
        "boot",
        "ApplicationRunner.java"
      ),
      unique
    );
    const packageReport = getPackageDependencies(
      path.join(
        "..",
        "resources",
        "spring-boot",
        "spring-boot-project",
        "spring-boot",
        "src",
        "main",
        "java",
        "org",
        "springframework",
        "boot",
        "admin"
      ),
      unique
    );
    const projectReport = getProjectDependencies(
      path.join(
        "..",
        "resources",
        "spring-boot",
        "spring-boot-project",
        "spring-boot",
        "src",
        "main",
        "java",
        "org",
        "springframework",
        "boot"
      ),
      unique
    );
    const results = await Promise.all([
      classReport,
      packageReport,
      projectReport,
    ]);

    writeToFile(path.join(compositeFolder, classFilename), results[0]).then(() => {
      console.log("Class Dependencies Report written to file.");
    });
    writeToFile(path.join(compositeFolder, packageFilename), results[1]).then(() => {
      console.log("Package Dependencies Report written to file.");
    });
    writeToFile(path.join(compositeFolder, projectFilename), results[2]).then(() => {
      console.log("Project Dependencies Report written to file.");
    });
    
  } catch (error) {
    console.error("Test Error:", error);
  }
}

async function writeToFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

runTests(false);
runTests(true);