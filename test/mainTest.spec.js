import path from "path";
import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
} from "../src/main.js";

async function runTests() {
  try {
    // Test getClassDependencies
    const classReport = await getClassDependencies(
      path.join("..", "resources", "assignment-01", "src", "main", "java", "pcd", "ass01", "BoidsSimulation.java")
    );
    console.log("Class Dependencies Report:");
    console.log(classReport);

    // Test getPackageDependencies
    const packageReport = await getPackageDependencies(
      path.join("..", "resources", "assignment-01", "src", "main", "java", "pcd", "ass01", "Controller")
    );
    console.log("\nPackage Dependencies Report:");
    console.log(packageReport);

    // Test getProjectDependencies
    const projectReport = await getProjectDependencies(
      path.join("..", "resources", "assignment-01", "src", "main", "java", "pcd", "ass01")
    );
    console.log("\nProject Dependencies Report:");
    console.log(projectReport);
  } catch (error) {
    console.error("Test Error:", error);
  }
}

runTests();
