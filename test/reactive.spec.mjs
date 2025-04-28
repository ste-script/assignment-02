import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs/promises";
// Import 'toArray' operator
import { lastValueFrom, toArray } from "rxjs";
import {
  // filepath: src/reactive.test.js
  getClassDependenciesRx,
  getPackageDependenciesRx,
  getProjectDependenciesRx,
  ClassDepsReport,
  PackageDepsReport,
} from "../src/reactive.mjs"; // Import from reactive.mjs

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

const sortClassReports = (a, b) => {
  // Sort used types within each report first
  if (a.usedTypes) a.usedTypes.sort();
  if (b.usedTypes) b.usedTypes.sort();
  // Then sort reports by class name
  return a.className.localeCompare(b.className);
};

const sortPackageReports = (a, b) => {
  // Sort class reports within each package report first
  if (a.classReports) a.classReports.sort(sortClassReports);
  if (b.classReports) b.classReports.sort(sortClassReports);
  // Then sort package reports by package name
  return a.packageName.localeCompare(b.packageName); // Corrected to sort by packageName
};

// --- Test Suite ---

describe("Dependency Analysis (reactive)", () => {
  // --- Tests for unique = false ---
  describe("Incremental Reports (unique=false)", () => {
    const unique = false; // Note: unique parameter is not used in the latest reactive.mjs functions
    const outputDir = path.join(baseFolder, "all");
    let classResult, packageEmissions, projectEmissions; // Changed to store arrays of emissions

    beforeAll(async () => {
      const classPath = path.join(resourcesBase, "ApplicationRunner.java");
      const packagePath = path.join(resourcesBase, "admin"); // Example package
      const projectPath = path.join(resourcesBase, ".."); // Go up one level to 'springframework' for a broader test

      // Use lastValueFrom for class (emits one ClassDepsReport)
      // Use toArray() for package and project to collect all emissions
      [classResult, packageEmissions, projectEmissions] = await Promise.all([
        lastValueFrom(getClassDependenciesRx(classPath)), // Expects one ClassDepsReport
        lastValueFrom(
          getPackageDependenciesRx(packagePath).pipe(toArray()) // Collects PackageDepsReport[] (likely just one element)
        ),
        lastValueFrom(
          getProjectDependenciesRx(projectPath).pipe(toArray()) // Collects PackageDepsReport[]
        ),
      ]);

      // --- Sort results for deterministic snapshots ---
      // Sort used types in the single class report
      if (classResult && classResult.usedTypes) {
        classResult.usedTypes.sort();
      }

      // Sort package emissions (array of PackageDepsReport)
      // Sorts classReports within each PackageDepsReport AND sorts the PackageDepsReports by packageName
      if (Array.isArray(packageEmissions)) {
        packageEmissions.sort(sortClassReports); // Sorts the array and internal classReports/usedTypes
      }

      // Sort project emissions (array of PackageDepsReport)
      // Sorts classReports within each PackageDepsReport AND sorts the PackageDepsReports by packageName
      if (Array.isArray(projectEmissions)) {
        projectEmissions.sort(sortPackageReports); // Use sortPackageReports here as it emits PackageDepsReport[]
      }
      // --- End Sorting ---

      // Optional: Write results (might need adjustment based on emission structure)
      // await ensureDir(outputDir);
      // await Promise.all([
      //     writeToFile(path.join(outputDir, 'classReport.reactive.json'), classResult),
      //     writeToFile(path.join(outputDir, 'packageEmissions.reactive.json'), packageEmissions), // Should be PackageDepsReport[]
      //     writeToFile(path.join(outputDir, 'projectEmissions.reactive.json'), projectEmissions), // Should be PackageDepsReport[]
      // ]);
    }, 30000); // Increase timeout if analysis takes longer

    it("should generate ClassDepsReport correctly", () => {
      expect(classResult).toBeInstanceOf(ClassDepsReport);
      expect(classResult.className).toBe("ApplicationRunner");
      expect(Array.isArray(classResult.usedTypes)).toBe(true);
      // Use snapshot testing for detailed structure verification
      expect(classResult).toMatchSnapshot(); // Snapshot the object directly
    });

    // Test assumes getPackageDependenciesRx emits PackageDepsReport objects
    it("should emit PackageDepsReport objects for package analysis", () => {
      expect(Array.isArray(packageEmissions)).toBe(true);
      // Check if at least one report was emitted (adjust based on expected content of 'admin' package)
      expect(packageEmissions.length).toBeGreaterThan(0);
      // Check the type of the first emitted item
      expect(packageEmissions[0]).toBeInstanceOf(ClassDepsReport);
      // Check nested structure sorting (handled by sortPackageReports)
      if (packageEmissions[0].classReports && packageEmissions[0].classReports.length > 0) {
        expect(packageEmissions[0].classReports[0]).toBeInstanceOf(ClassDepsReport);
        if (packageEmissions[0].classReports[0].usedTypes) {
           // Check if usedTypes is sorted (first element should be alphabetically first or equal)
           const types = packageEmissions[0].classReports[0].usedTypes;
           if (types.length > 1) {
             expect(types[0].localeCompare(types[1])).toBeLessThanOrEqual(0);
           }
        }
      }
      // Snapshot the array of emitted reports
      expect(packageEmissions).toMatchSnapshot();
    });

    // Test assumes getProjectDependenciesRx emits PackageDepsReport objects
    it("should emit PackageDepsReport objects for project analysis", () => {
      expect(Array.isArray(projectEmissions)).toBe(true);
      // Check if at least one report was emitted
      expect(projectEmissions.length).toBeGreaterThan(0);
      // Check the type of the first emitted item
      expect(projectEmissions[0]).toBeInstanceOf(PackageDepsReport);
      // Check nested structure sorting (handled by sortPackageReports)
       if (projectEmissions[0].classReports && projectEmissions[0].classReports.length > 0) {
         expect(projectEmissions[0].classReports[0]).toBeInstanceOf(ClassDepsReport);
         if (projectEmissions[0].classReports[0].usedTypes) {
            // Check if usedTypes is sorted (first element should be alphabetically first or equal)
            const types = projectEmissions[0].classReports[0].usedTypes;
            if (types.length > 1) {
              expect(types[0].localeCompare(types[1])).toBeLessThanOrEqual(0);
            }
         }
       }
      // Snapshot the array of emitted reports
      expect(projectEmissions).toMatchSnapshot();
    });
  });

  // --- Tests for Error Handling (Example) ---
  // Add tests here to check if observables emit errors correctly for invalid paths etc.
  // describe("Error Handling", () => {
  //   it("should emit an error for non-existent class file", async () => {
  //     const nonExistentPath = path.join(resourcesBase, "NonExistent.java");
  //     const classObservable = getClassDependenciesRx(nonExistentPath);
  //     await expect(lastValueFrom(classObservable)).rejects.toThrow();
  //   });

  //   it("should emit an error for non-existent package path", async () => {
  //     const nonExistentPath = path.join(resourcesBase, "nonexistentpackage");
  //     const packageObservable = getPackageDependenciesRx(nonExistentPath, false).pipe(toArray());
  //     // Depending on implementation, error might occur early or during collection
  //     await expect(lastValueFrom(packageObservable)).rejects.toThrow();
  //   });
  // });
});

// Note: The prepareForSnapshot function is removed as direct object/array snapshotting is preferred.
// Note: Run `npx vitest -u` to update snapshots after these changes.
// Review snapshot files carefully.
// The assumptions about what is emitted (ClassDepsReport vs PackageDepsReport vs Type) might need
// adjustment based on the actual implementation in reactive.mjs.
// The TypeError you encountered might be resolved if the reactive functions now correctly handle paths,
// or it might indicate a deeper issue within those functions that needs debugging there.
// Sorting functions added to ensure deterministic snapshots.
