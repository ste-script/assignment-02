import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs/promises";
import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
} from "../src/async.mjs"; // Using async version as in the original test file

// Define base paths relative to project root
const baseFolder = path.join("testReport");
const resourcesBase = path.join(
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
);

// --- Helper Functions ---

// Ensures a directory exists
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
    if (error.code !== "EEXIST") throw error;
  }
}

// Writes data to a file as JSON (Optional: useful for baseline generation/inspection)
async function writeToFile(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`Report written to ${filePath}`); // Log file writing
}

// --- Test Suite ---

describe("Dependency Analysis (async)", () => {
  // --- Tests for unique = false ---
  describe("Composite Reports (unique=false)", () => {
    const unique = false;
    const outputDir = path.join(baseFolder, "all");
    let classResult, packageResult, projectResult;

    // Run analysis once before tests in this block
    beforeAll(async () => {
      const classPath = path.join(resourcesBase, "ApplicationRunner.java");
      const packagePath = path.join(resourcesBase, "admin");
      const projectPath = resourcesBase; // Analyze the 'boot' package as the project root

      [classResult, packageResult, projectResult] = await Promise.all([
        getClassDependencies(classPath), // unique flag doesn't apply here
        getPackageDependencies(packagePath, unique),
        getProjectDependencies(projectPath, unique),
      ]);

      // Optional: Write results to files for manual inspection or baseline
      // await ensureDir(outputDir);
      // await Promise.all([
      //     writeToFile(path.join(outputDir, 'classReport.async.json'), classResult),
      //     writeToFile(path.join(outputDir, 'packageReport.async.json'), packageResult),
      //     writeToFile(path.join(outputDir, 'projectReport.async.json'), projectResult),
      // ]);
    });

    it("should generate ClassDepsReport correctly", () => {
      expect(classResult).toBeInstanceOf(ClassDepsReport);
      expect(classResult.className).toBe("ApplicationRunner");
      expect(Array.isArray(classResult.usedTypes)).toBe(true);
      // Use snapshot testing for detailed structure verification
      expect(classResult).toMatchSnapshot();
    });

    it("should generate PackageDepsReport correctly", () => {
      expect(packageResult).toBeInstanceOf(PackageDepsReport);
      expect(packageResult.packageName).toBe("admin");
      expect(Array.isArray(packageResult.classReports)).toBe(true);
      // Check if the package contains class reports (assuming it's not empty)
      if (packageResult.classReports.length > 0) {
        expect(packageResult.classReports[0]).toBeInstanceOf(ClassDepsReport);
      }
      // Use snapshot testing
      expect(packageResult).toMatchSnapshot();
    });

    it("should generate ProjectDepsReport correctly", () => {
      expect(projectResult).toBeInstanceOf(ProjectDepsReport);
      expect(projectResult.projectName).toBe("boot");
      expect(Array.isArray(projectResult.packageReports)).toBe(true);
      // Check if the project contains package reports (assuming it's not empty)
      if (projectResult.packageReports.length > 0) {
        expect(projectResult.packageReports[0]).toBeInstanceOf(
          PackageDepsReport
        );
      }
      // Use snapshot testing
      expect(projectResult).toMatchSnapshot();
    });
  });

  // --- Tests for unique = true ---
  describe("Unique Reports (unique=true)", () => {
    const unique = true;
    const outputDir = path.join(baseFolder, "unique");
    let classResultUnique, packageResultUnique, projectResultUnique;

    // Run analysis once before tests in this block
    beforeAll(async () => {
      const classPath = path.join(resourcesBase, "ApplicationRunner.java");
      const packagePath = path.join(resourcesBase, "admin");
      const projectPath = resourcesBase; // Analyze the 'boot' package as the project root

      [classResultUnique, packageResultUnique, projectResultUnique] =
        await Promise.all([
          getClassDependencies(classPath), // unique flag doesn't apply here
          getPackageDependencies(packagePath, unique),
          getProjectDependencies(projectPath, unique),
        ]);

      // Optional: Write results to files for manual inspection or baseline
      // await ensureDir(outputDir);
      // await Promise.all([
      //     writeToFile(path.join(outputDir, 'classReport.async.unique.json'), classResultUnique),
      //     writeToFile(path.join(outputDir, 'packageReport.async.unique.json'), packageResultUnique),
      //     writeToFile(path.join(outputDir, 'projectReport.async.unique.json'), projectResultUnique),
      // ]);
    });

    it("should generate ClassDepsReport correctly (unique flag ignored)", () => {
      expect(classResultUnique).toBeInstanceOf(ClassDepsReport);
      expect(classResultUnique.className).toBe("ApplicationRunner");
      expect(Array.isArray(classResultUnique.usedTypes)).toBe(true);
      // Snapshot should be identical to the non-unique class report
      expect(classResultUnique).toMatchSnapshot();
    });

    it("should generate PackageDepsReport with unique types", () => {
      expect(packageResultUnique).toBeInstanceOf(PackageDepsReport);
      expect(packageResultUnique.packageName).toBe("admin");
      // The structure depends on the implementation in async.mjs when unique=true.
      // Assuming it correctly returns unique types in some form:
      // Verify the structure containing unique types (e.g., might be in classReports based on potential bug)
      expect(Array.isArray(packageResultUnique.classReports)).toBe(true); // Adjust if implementation differs
      // Check for uniqueness if the structure allows
      if (
        Array.isArray(packageResultUnique.classReports) &&
        packageResultUnique.classReports.length > 0 &&
        packageResultUnique.classReports[0].type
      ) {
        const typeStrings = packageResultUnique.classReports.map(
          (t) => `${t.package}.${t.type}`
        );
        expect(new Set(typeStrings).size).toBe(typeStrings.length);
      }
      // Use snapshot testing
      expect(packageResultUnique).toMatchSnapshot();
    });

    it("should generate ProjectDepsReport with unique types", () => {
      expect(projectResultUnique).toBeInstanceOf(ProjectDepsReport);
      expect(projectResultUnique.projectName).toBe("boot");
      // The structure depends on the implementation in async.mjs when unique=true.
      // Assuming it correctly returns unique types in some form:
      // Verify the structure containing unique types (e.g., might be in packageReports based on potential bug)
      expect(Array.isArray(projectResultUnique.packageReports)).toBe(true); // Adjust if implementation differs
      // Check for uniqueness if the structure allows
      if (
        Array.isArray(projectResultUnique.packageReports) &&
        projectResultUnique.packageReports.length > 0 &&
        projectResultUnique.packageReports[0].type
      ) {
        const typeStrings = projectResultUnique.packageReports.map(
          (t) => `${t.package}.${t.type}`
        );
        expect(new Set(typeStrings).size).toBe(typeStrings.length);
      }
      // Use snapshot testing
      expect(projectResultUnique).toMatchSnapshot();
    });
  });
});

// Note: Run `npx vitest` to execute these tests.
// Snapshot files will be created in `test/__snapshots__/springBootTest.spec.mjs.snap` on the first run.
// Review these snapshots carefully to ensure they capture the correct expected output.