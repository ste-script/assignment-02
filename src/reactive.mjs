import { promises as fs } from "fs";
import { basename, join } from "path";
import { parse, BaseJavaCstVisitorWithDefaults } from "java-parser";
import {
  from,
  of,
  throwError,
  forkJoin,
  EMPTY,
  map,
  mergeMap,
  toArray,
  catchError,
  filter,
  distinct,
  reduce,
  switchMap,
} from "rxjs";

// --- Report Classes (unchanged) ---
class ClassDepsReport {
  constructor(className, usedTypes) {
    this.className = className;
    this.usedTypes = usedTypes; // Array of { type: string, package: string }
  }
}

class PackageDepsReport {
  constructor(packageName, classReportsOrUniqueTypes) {
    this.packageName = packageName;
    // Depending on the 'unique' flag, this could be ClassDepsReport[] or unique {type, package}[]
    if (
      Array.isArray(classReportsOrUniqueTypes) &&
      classReportsOrUniqueTypes[0] instanceof ClassDepsReport
    ) {
      this.classReports = classReportsOrUniqueTypes;
      this.uniqueTypes = null;
    } else {
      this.classReports = null;
      this.uniqueTypes = classReportsOrUniqueTypes;
    }
  }
}

class ProjectDepsReport {
  constructor(projectName, packageReportsOrUniqueTypes) {
    this.projectName = projectName;
    // Depending on the 'unique' flag, this could be PackageDepsReport[] or unique {type, package}[]
    if (
      Array.isArray(packageReportsOrUniqueTypes) &&
      packageReportsOrUniqueTypes[0] instanceof PackageDepsReport
    ) {
      this.packageReports = packageReportsOrUniqueTypes;
      this.uniqueTypes = null;
    } else {
      this.packageReports = null;
      this.uniqueTypes = packageReportsOrUniqueTypes;
    }
  }
}

// --- CST Visitor (unchanged) ---
class DependecyAnalyserCstVisitor extends BaseJavaCstVisitorWithDefaults {
  constructor() {
    super();
    this.customResult = [];
    this.validateVisitor();
  }
  // Extract types from import statements
  importDeclaration(ctx) {
    if (ctx.packageOrTypeName && ctx.packageOrTypeName[0].children.Identifier) {
      const identifiers = ctx.packageOrTypeName[0].children.Identifier;
      if (identifiers.length > 0) {
        const typeName = identifiers[identifiers.length - 1].image;
        const packageName = identifiers
          .slice(0, identifiers.length - 1)
          .map((id) => id.image)
          .join(".");

        this.customResult.push({ type: typeName, package: packageName });
      }
    }
  }
}

// --- Helper Functions (sync part, unchanged) ---
function extractDependenciesFromASTSync(ast) {
  const types = new Set();
  const visitorCollector = new DependecyAnalyserCstVisitor();
  visitorCollector.visit(ast);
  const customResult = visitorCollector.customResult;

  // Deduplicate within the class itself before returning
  const seen = new Set();
  const uniqueResult = [];
  customResult.forEach((type) => {
    const key = `${type.package}.${type.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResult.push({
        type: type.type,
        package: type.package,
      });
    }
  });
  return uniqueResult;
}

// --- Reactive Functions ---

function getClassDependenciesRx(classSrcFile) {
  return from(fs.readFile(classSrcFile, "utf8")).pipe(
    map((content) => {
      const ast = parse(content);
      const usedTypes = extractDependenciesFromASTSync(ast); // Use sync version here
      const className = basename(classSrcFile, ".java");
      return new ClassDepsReport(className, usedTypes);
    }),
    catchError((error) =>
      throwError(
        () =>
          new Error(`Error analyzing class ${classSrcFile}: ${error.message}`)
      )
    )
  );
}

function getPackageDependenciesRx(packageSrcFolder, unique = false) {
  const packageName = basename(packageSrcFolder);
  return from(fs.readdir(packageSrcFolder)).pipe(
    // Find all .java files
    mergeMap((files) =>
      from(files).pipe(
        filter((file) => file.endsWith(".java")),
        map((file) => join(packageSrcFolder, file)),
        toArray() // Collect java file paths into an array
      )
    ),
    // Process each java file
    mergeMap((javaFiles) => {
      // Create an observable for each class dependency analysis
      const classObservables = javaFiles.map((file) =>
        getClassDependenciesRx(file)
      );
      return forkJoin(classObservables); // Run analyses in parallel
    }),
    // Process the results based on the 'unique' flag
    mergeMap((classReports) => {
      if (unique) {
        // Flatten all used types from all class reports
        return from(classReports).pipe(
          mergeMap((report) => from(report.usedTypes)), // Emit each type individually
          distinct((t) => `${t.package}.${t.type}`), // Deduplicate based on package.type
          toArray(), // Collect unique types
          map((uniqueTypes) => new PackageDepsReport(packageName, uniqueTypes))
        );
      } else {
        // Return the array of class reports directly
        return of(new PackageDepsReport(packageName, classReports));
      }
    }),
    catchError((error) =>
      throwError(
        () =>
          new Error(
            `Error analyzing package ${packageSrcFolder}: ${error.message}`
          )
      )
    )
  );
}

function findPackageDirectoriesRx(dir) {
  return from(fs.readdir(dir, { withFileTypes: true })).pipe(
    mergeMap((entries) => from(entries)), // Emit each entry
    mergeMap((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Recursively find packages in subdirectories
        return findPackageDirectoriesRx(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".java")) {
        // If a java file is found, this directory is a package directory
        return of({ isPackage: true, path: dir });
      }
    }),
    // Collect results, ensuring we only add package paths once
    reduce(
      (acc, curr) => {
        if (curr.isPackage && !acc.paths.has(curr.path)) {
          acc.paths.add(curr.path);
          acc.results.push(curr.path);
        }
        return acc;
      },
      { paths: new Set(), results: [] }
    ),
    map((acc) => acc.results), // Return only the array of paths
    // If the initial directory itself contained Java files but no subpackages were found
    // the reduce step might yield an empty array. We need to check the root dir itself.
    // This part is tricky with pure recursion. Let's refine.

    // Alternative approach: Check current dir first, then recurse.
    switchMap(() => {
      // Check if the current directory `dir` contains any .java files
      return from(fs.readdir(dir)).pipe(
        map((files) => files.some((file) => file.endsWith(".java"))),
        mergeMap((hasJavaFile) => {
          // Find subdirectories
          return from(fs.readdir(dir, { withFileTypes: true })).pipe(
            mergeMap((entries) => from(entries)),
            filter((entry) => entry.isDirectory()),
            map((entry) => join(dir, entry.name)),
            // Recursively call for subdirectories
            mergeMap((subDir) => findPackageDirectoriesRx(subDir)),
            toArray(), // Collect results from all subdirectories
            // Combine results: current dir (if it's a package) + subpackages
            map((subPackagesArrays) => {
              const allSubPackages = subPackagesArrays.flat(); // Flatten the array of arrays
              if (hasJavaFile) {
                // Add current dir if it has Java files and isn't already included
                // (Set prevents duplicates if added by a sub-call somehow)
                return Array.from(new Set([dir, ...allSubPackages]));
              } else {
                return allSubPackages;
              }
            })
          );
        })
      );
    }),
    // Final distinct check just in case
    mergeMap((paths) => from(paths)),
    distinct(),
    toArray()
  );
}

function getProjectDependenciesRx(projectSrcFolder, unique = false) {
  const projectName = basename(projectSrcFolder);
  return findPackageDirectoriesRx(projectSrcFolder).pipe(
    mergeMap((packageDirs) => {
      // Get dependencies for each package
      const packageObservables = packageDirs.map(
        (dir) => getPackageDependenciesRx(dir, unique && !unique) // Pass false if project unique is true
      );
      return forkJoin(packageObservables);
    }),
    // Process results based on the 'unique' flag
    mergeMap((packageReports) => {
      if (unique) {
        // Flatten all used types from all package reports
        return from(packageReports).pipe(
          mergeMap((pkgReport) =>
            // If the package report already contains unique types (because unique=true was passed down)
            // use pkgReport.uniqueTypes, otherwise flatten classReports
            from(pkgReport.classReports).pipe(
              mergeMap((classReport) => from(classReport.usedTypes))
            )
          ),
          distinct((t) => `${t.package}.${t.type}`), // Deduplicate across the whole project
          toArray(), // Collect unique types for the project
          map(
            (uniqueProjectTypes) =>
              new ProjectDepsReport(projectName, uniqueProjectTypes)
          )
        );
      } else {
        // Return the array of package reports directly
        return of(new ProjectDepsReport(projectName, packageReports));
      }
    }),
    catchError((error) =>
      throwError(
        () =>
          new Error(
            `Error analyzing project ${projectSrcFolder}: ${error.message}`
          )
      )
    )
  );
}

export {
  getClassDependenciesRx,
  getPackageDependenciesRx,
  getProjectDependenciesRx,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
};
