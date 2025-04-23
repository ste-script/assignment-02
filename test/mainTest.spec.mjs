import path from "path";
import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
} from "../src/async.mjs";
import { describe, it, expect } from "vitest";

describe("Dependency Analysis Tests", () => {
  it("should analyze class dependencies correctly", async () => {
    const classReport = await getClassDependencies(
      path.join(
        "resources",
        "assignment-01",
        "src",
        "main",
        "java",
        "pcd",
        "ass01",
        "BoidsSimulation.java"
      )
    );
    expect(classReport).toBeDefined();
    expect(classReport.className).toBe("BoidsSimulation");
  });
  it("should analyze package dependencies correctly", async () => {
    const packageReport = await getPackageDependencies(
      path.join(
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
    expect(packageReport).toBeDefined();
    expect(packageReport.packageName).toBe("Controller");
  });
  it("should analyze project dependencies correctly", async () => {
    const projectReport = await getProjectDependencies(
      path.join(
        "resources",
        "assignment-01",
        "src",
        "main",
        "java",
        "pcd",
        "ass01"
      )
    );
    expect(projectReport).toBeDefined();
    expect(projectReport.projectName).toBe("ass01");
  });
});
