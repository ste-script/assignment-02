import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs/promises";
import { lastValueFrom, firstValueFrom } from "rxjs"; // Use lastValueFrom or firstValueFrom
import {
  // filepath: src/reactive.test.js
  getClassDependenciesRx,
  getPackageDependenciesRx,
  getProjectDependenciesRx,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
} from "../src/reactive.mjs"; // Import from reactive.js

// Define base paths relative to project root (assuming tests run from root)
const baseFolder = path.join("testReport"); // Output folder for optional reports
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

describe("Dependency Analysis (reactive)", () => {
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

      // Use lastValueFrom to get the final emitted value from the observables
      [classResult, packageResult, projectResult] = await Promise.all([
        lastValueFrom(getClassDependenciesRx(classPath)), // unique flag doesn't apply here
        lastValueFrom(getPackageDependenciesRx(packagePath, unique)),
        lastValueFrom(getProjectDependenciesRx(projectPath, unique)),
      ]);

      // Optional: Write results to files for manual inspection or baseline
      // await ensureDir(outputDir);
      // await Promise.all([
      //     writeToFile(path.join(outputDir, 'classReport.reactive.json'), classResult),
      //     writeToFile(path.join(outputDir, 'packageReport.reactive.json'), packageResult),
      //     writeToFile(path.join(outputDir, 'projectReport.reactive.json'), projectResult),
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
      expect(packageResult.uniqueTypes).toBeNull(); // unique=false
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
      expect(projectResult.uniqueTypes).toBeNull(); // unique=false
      // Check if the project contains package reports (assuming it's not empty)
      if (projectResult.packageReports.length > 0) {
        expect(projectResult.packageReports[0]).toBeInstanceOf(
          PackageDepsReport
        );
        // Check nested structure if needed
        if (projectResult.packageReports[0].classReports?.length > 0) {
          expect(
            projectResult.packageReports[0].classReports[0]
          ).toBeInstanceOf(ClassDepsReport);
        }
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
          lastValueFrom(getClassDependenciesRx(classPath)), // unique flag doesn't apply here
          lastValueFrom(getPackageDependenciesRx(packagePath, unique)),
          lastValueFrom(getProjectDependenciesRx(projectPath, unique)),
        ]);

      // Optional: Write results to files for manual inspection or baseline
      // await ensureDir(outputDir);
      // await Promise.all([
      //     writeToFile(path.join(outputDir, 'classReport.reactive.unique.json'), classResultUnique),
      //     writeToFile(path.join(outputDir, 'packageReport.reactive.unique.json'), packageResultUnique),
      //     writeToFile(path.join(outputDir, 'projectReport.reactive.unique.json'), projectResultUnique),
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
      expect(packageResultUnique.classReports).toBeNull(); // unique=true
      expect(Array.isArray(packageResultUnique.uniqueTypes)).toBe(true);
      // Check for uniqueness
      if (packageResultUnique.uniqueTypes.length > 0) {
        const typeStrings = packageResultUnique.uniqueTypes.map(
          (t) => `${t.package}.${t.type}`
        );
        expect(new Set(typeStrings).size).toBe(typeStrings.length);
        // Check structure of one element
        expect(packageResultUnique.uniqueTypes[0]).toHaveProperty("type");
        expect(packageResultUnique.uniqueTypes[0]).toHaveProperty("package");
      }
      // Use snapshot testing
      expect(packageResultUnique).toMatchSnapshot();
    });

    it("should generate ProjectDepsReport with unique types", () => {
      expect(projectResultUnique).toBeInstanceOf(ProjectDepsReport);
      expect(projectResultUnique.projectName).toBe("boot");
      expect(projectResultUnique.packageReports).toBeNull(); // unique=true
      expect(Array.isArray(projectResultUnique.uniqueTypes)).toBe(true);
      // Check for uniqueness
      if (projectResultUnique.uniqueTypes.length > 0) {
        const typeStrings = projectResultUnique.uniqueTypes.map(
          (t) => `${t.package}.${t.type}`
        );
        expect(new Set(typeStrings).size).toBe(typeStrings.length);
        // Check structure of one element
        expect(projectResultUnique.uniqueTypes[0]).toHaveProperty("type");
        expect(projectResultUnique.uniqueTypes[0]).toHaveProperty("package");
      }
      // Use snapshot testing
      expect(projectResultUnique).toMatchSnapshot();
    });
  });

  // --- Error Handling Tests ---
  describe("Error Handling", () => {
    it("should reject with an error for a non-existent class file", async () => {
      const nonExistentFile = path.join(resourcesBase, "NonExistentClass.java");
      const observable = getClassDependenciesRx(nonExistentFile);
      // Use expect(...).rejects with lastValueFrom
      await expect(lastValueFrom(observable)).rejects.toThrowError(
        /Error analyzing class .*NonExistentClass\.java/
      );
    });

    it("should reject with an error for a non-existent package folder", async () => {
      const nonExistentFolder = path.join(resourcesBase, "nonexistentpackage");
      const observable = getPackageDependenciesRx(nonExistentFolder);
      await expect(lastValueFrom(observable)).rejects.toThrowError(
        /Error analyzing package .*nonexistentpackage/
      );
      // Check for specific underlying error (like ENOENT) if needed
      await expect(lastValueFrom(observable)).rejects.toThrowError(/ENOENT/); // Check if the error message contains ENOENT
    });

    it("should reject with an error for a non-existent project folder", async () => {
      const nonExistentFolder = path.join("resources", "nonexistentproject");
      const observable = getProjectDependenciesRx(nonExistentFolder);
      await expect(lastValueFrom(observable)).rejects.toThrowError(
        /Error analyzing project .*nonexistentproject/
      );
      await expect(lastValueFrom(observable)).rejects.toThrowError(/ENOENT/); // Check if the error message contains ENOENT
    });
  });
});

// Note: Run `npx vitest` to execute these tests.
// Snapshot files will be created in `src/__snapshots__/reactive.test.js.snap` on the first run.
// Review these snapshots carefully to ensure they capture the correct expected output.
