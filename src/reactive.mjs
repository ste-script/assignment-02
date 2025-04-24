import { promises as fs } from "fs";
import { basename, join } from "path";
import { parse, BaseJavaCstVisitorWithDefaults } from "java-parser";
import {
  from,
  of,
  throwError,
  EMPTY,
  map,
  mergeMap,
  catchError,
  filter,
} from "rxjs";

// --- Report Classes (Add packageName to ClassDepsReport) ---
class ClassDepsReport {
  constructor(packageName, className, usedTypes) { // Added packageName
    this.packageName = packageName;
    this.className = className;
    this.usedTypes = usedTypes; // Array of { type: string, package: string }
  }
}

class PackageDepsReport { // This class might become less central for incremental emission
  constructor(packageName, classReports) {
    this.packageName = packageName;
    this.classReports = classReports; // Array of ClassDepsReport
    // Remove uniqueTypes logic for simplicity with incremental class emission
  }
}

class ProjectDepsReport { // This class might become less central for incremental emission
  constructor(projectName, packageReports) {
    this.projectName = projectName;
    this.packageReports = packageReports; // Array of PackageDepsReport
    // Remove uniqueTypes logic for simplicity with incremental class emission
  }
}

// --- CST Visitor (unchanged) ---
class DependecyAnalyserCstVisitor extends BaseJavaCstVisitorWithDefaults {
  constructor() {
    super();
    this.customResult = [];
    this.validateVisitor();
  }
  importDeclaration(ctx) {
    if (ctx.packageOrTypeName && ctx.packageOrTypeName[0].children.Identifier) {
      const identifiers = ctx.packageOrTypeName[0].children.Identifier;
      if (identifiers.length > 0) {
        const typeName = identifiers[identifiers.length - 1].image;
        const packageName = identifiers
          .slice(0, identifiers.length - 1)
          .map((id) => id.image)
          .join(".");
        // Basic check to avoid adding self-package imports if needed, though maybe not necessary
        // if (packageName !== this.currentPackageName) { // Requires passing currentPackageName
        this.customResult.push({ type: typeName, package: packageName });
        // }
      }
    }
  }
  // Potentially add visits to other constructs like:
  // - explicitConstructorInvocation: For super() or this() calls if needed.
  // - classOrInterfaceType: To find types used in variable declarations, method signatures, etc.
  // - methodInvocation: To find types used in static method calls.
  // - annotations: If dependencies via annotations are relevant.
}

// --- Helper Functions (sync part, unchanged) ---
function extractDependenciesFromASTSync(ast) {
  const types = new Set();
  const visitorCollector = new DependecyAnalyserCstVisitor();
  visitorCollector.visit(ast);
  const customResult = visitorCollector.customResult;

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

// getClassDependenciesRx: Now takes packageName to include it in the report
function getClassDependenciesRx(packageName, classSrcFile) {
  return from(fs.readFile(classSrcFile, "utf8")).pipe(
    map((content) => {
      try {
        const ast = parse(content);
        const usedTypes = extractDependenciesFromASTSync(ast); // Use sync version here
        const className = basename(classSrcFile, ".java");
        // Create report including the packageName
        return new ClassDepsReport(packageName, className, usedTypes);
      } catch (parseError) {
        // Throw a specific error for parsing issues
        throw new Error(`Error parsing ${classSrcFile}: ${parseError.message}`);
      }
    }),
    catchError((error) => {
      // Catch both file read and parsing errors
      // Log the error server-side for debugging
      console.error(`Error processing class ${classSrcFile}: ${error.message}`);
      // Emit an empty observable or a specific error object if needed downstream
      // For incremental updates, skipping the problematic file might be best
      return EMPTY; // Skip this class on error
      // Alternatively, throw a structured error:
      // return throwError(() => ({ type: 'class_error', file: classSrcFile, message: error.message }));
    })
  );
}

// getPackageDependenciesRx: Modified to emit ClassDepsReport incrementally
function getPackageDependenciesRx(packageSrcFolder) {
  const packageName = basename(packageSrcFolder);
  return from(fs.readdir(packageSrcFolder)).pipe(
    // Find all .java files
    mergeMap((files) =>
      from(files).pipe(
        filter((file) => file.endsWith(".java")),
        map((file) => join(packageSrcFolder, file))
        // Don't collect toArray here, process files individually
      )
    ),
    // Process each java file individually and emit its ClassDepsReport
    mergeMap((javaFile) =>
      // Pass packageName to getClassDependenciesRx
      getClassDependenciesRx(packageName, javaFile)
      // No need for forkJoin or collecting results here
    ),
    catchError((error) => {
      // Catch errors related to reading the directory itself
      console.error(
        `Error reading package directory ${packageSrcFolder}: ${error.message}`
      );
      // return throwError(() => new Error(`Error analyzing package ${packageSrcFolder}: ${error.message}`));
      return EMPTY; // Skip package on directory read error
    })
  );
}

// findPackageDirectoriesRx: (Refined logic from previous state)
function findPackageDirectoriesRx(dir) {
  // Check if the current directory `dir` contains any .java files
  const hasJavaFilesInCurrentDir$ = from(fs.readdir(dir)).pipe(
    map((files) => files.some((file) => file.endsWith(".java"))),
    catchError((err) => {
      console.error(`Error reading directory ${dir}: ${err.message}`);
      return of(false); // Assume no java files if error reading dir
    })
  );

  // Find subdirectories
  const subDirectories$ = from(fs.readdir(dir, { withFileTypes: true })).pipe(
    mergeMap((entries) => from(entries)), // Emit each entry
    filter((entry) => entry.isDirectory()),
    map((entry) => join(dir, entry.name)),
    catchError((err) => {
      console.error(
        `Error reading directory entries in ${dir}: ${err.message}`
      );
      return EMPTY; // Ignore errors listing subdirs
    })
  );

  // Recursively find package directories in subdirectories
  const subPackages$ = subDirectories$.pipe(
    mergeMap((subDir) => findPackageDirectoriesRx(subDir), 1) // Concurrency 1 for depth-first like traversal
  );

  return hasJavaFilesInCurrentDir$.pipe(
    mergeMap((hasJavaFile) => {
      const currentDir$ = hasJavaFile ? of(dir) : EMPTY;
      // Concatenate the current directory (if it's a package) with results from subdirectories
      return from([currentDir$, subPackages$]).pipe(
        mergeMap((obs) => obs) // Flatten the streams: emits currentDir (if applicable), then emits subpackages
      );
    })
  );
}

// getProjectDependenciesRx: Modified to emit ClassDepsReport incrementally
function getProjectDependenciesRx(projectSrcFolder) {
  // const projectName = basename(projectSrcFolder); // Not strictly needed if emitting class reports

  // findPackageDirectoriesRx now emits package paths one by one
  return findPackageDirectoriesRx(projectSrcFolder).pipe(
    // For each package directory found, get its class dependencies incrementally
    mergeMap((packageDir) =>
      getPackageDependenciesRx(packageDir) // This now emits ClassDepsReport objects
      // No need for forkJoin or collecting results here
    ),
    // No need to construct ProjectDepsReport here, as we are emitting ClassDepsReport
    catchError((error) => {
      // Catch errors from findPackageDirectoriesRx or downstream
      console.error(
        `Error analyzing project ${projectSrcFolder}: ${error.message}`
      );
      // Decide how to handle project-level errors. Maybe send an error event?
      return throwError(
        () =>
          new Error(
            `Error analyzing project ${projectSrcFolder}: ${error.message}`
          )
      );
      // Or return EMPTY to just stop emitting
      // return EMPTY;
    })
    // We are now emitting a stream of ClassDepsReport objects
  );
}

export {
  // Keep exports, even if some classes are less central now
  getClassDependenciesRx,
  getPackageDependenciesRx,
  getProjectDependenciesRx,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
};
