import { promises as fs } from "fs";
import { basename, join } from "path";
import {
  DependecyAnalyserCstVisitor,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport, // Keep if needed elsewhere
} from "./parser.mjs";
import { parse } from "java-parser";
import {
  from,
  of,
  throwError,
  EMPTY,
  map,
  mergeMap,
  catchError,
  filter,
  concat, // Added for findPackageDirectoriesRx
  take, // Added for findPackageDirectoriesRx
  defaultIfEmpty, // Added for findPackageDirectoriesRx
  toArray, // Added for getPackageDependenciesRx
} from "rxjs";

function extractDependenciesFromAST(ast) {
  const visitorCollector = new DependecyAnalyserCstVisitor();
  visitorCollector.visit(ast);
  // Return the unique type strings collected
  return Array.from(visitorCollector.customResult);
}

// --- Reactive Functions ---

// getClassDependenciesRx: Takes only the class source file path
function getClassDependenciesRx(classSrcFile) {
  return from(fs.readFile(classSrcFile, "utf8")).pipe(
    map((content) => {
      try {
        const ast = parse(content);
        const usedTypes = extractDependenciesFromAST(ast); // Use sync version here
        const className = basename(classSrcFile, ".java");
        // Filter out self-references
        const ownNameRegex = new RegExp(`(^|\\.)${className}$`);
        const filteredTypes = usedTypes.filter(
          (type) => !ownNameRegex.test(type)
        );
        return new ClassDepsReport(className, filteredTypes);
      } catch (parseError) {
        // Throw a specific error for parsing issues
        throw new Error(`Error parsing ${classSrcFile}: ${parseError.message}`);
      }
    }),
    catchError((error) => {
      // Catch both file read and parsing errors
      console.error(
        `Error processing class ${basename(classSrcFile)}: ${error.message}`
      );
      return EMPTY; // Skip this class on error
    })
  );
}

// getPackageDependenciesRx: Modified to emit a single PackageDepsReport
function getPackageDependenciesRx(packageSrcFolder) {
  const packageName = basename(packageSrcFolder); // Get package name from folder path
  return from(fs.readdir(packageSrcFolder, { withFileTypes: true })).pipe(
    // Process directory entries
    mergeMap((dirents) => from(dirents)), // Emit each Dirent object individually
    // Filter for actual files ending with .java
    filter((dirent) => dirent.isFile() && dirent.name.endsWith(".java")),
    // Map to the full path of the java file
    map((dirent) => join(packageSrcFolder, dirent.name)),
    // Process each java file individually and get its ClassDepsReport
    mergeMap(
      (javaFile) => getClassDependenciesRx(javaFile)
      // Optional: Limit concurrency if needed
      // 4
    ),
    filter((report) => report !== null),
    catchError((error) => {
      // Catch errors related to reading the directory itself
      console.error(
        `Error analyzing package ${packageSrcFolder}: ${error.message}`
      );
      return EMPTY; // Skip package on directory read error or other errors in the chain
    })
  );
}

function getPackageDependenciesRxForProjectDeps(packageSrcFolder) {
  const packageName = basename(packageSrcFolder); // Get package name from folder path
  return from(fs.readdir(packageSrcFolder, { withFileTypes: true })).pipe(
    // Process directory entries
    mergeMap((dirents) => from(dirents)), // Emit each Dirent object individually
    // Filter for actual files ending with .java
    filter((dirent) => dirent.isFile() && dirent.name.endsWith(".java")),
    // Map to the full path of the java file
    map((dirent) => join(packageSrcFolder, dirent.name)),
    // Process each java file individually and get its ClassDepsReport
    mergeMap(
      (javaFile) => getClassDependenciesRx(javaFile)
      // Optional: Limit concurrency if needed
      // 4
    ),
    // Collect all ClassDepsReport objects for this package into an array
    toArray(),
    // Map the array of ClassDepsReport objects to a single PackageDepsReport
    map((classReports) => {
      // Only create a report if there were successfully processed classes
      if (classReports && classReports.length > 0) {
        return new PackageDepsReport(packageName, classReports);
      }
      return null; // Indicate no report generated for this package (e.g., all files failed)
    }),
    // Filter out packages that resulted in no reports
    filter((report) => report !== null),
    catchError((error) => {
      // Catch errors related to reading the directory itself
      console.error(
        `Error analyzing package ${packageSrcFolder}: ${error.message}`
      );
      return EMPTY; // Skip package on directory read error or other errors in the chain
    })
  );
}

// findPackageDirectoriesRx: (Refined logic from previous state)
function findPackageDirectoriesRx(dir) {
  // Check if the current directory `dir` contains any .java files
  const hasJavaFilesInCurrentDir$ = from(
    fs.readdir(dir, { withFileTypes: true })
  ).pipe(
    // Convert the array of dirents to an observable stream of dirents
    mergeMap((dirents) => from(dirents)),
    // Check if any entry is a file ending with .java
    filter((dirent) => dirent.isFile() && dirent.name.endsWith(".java")),
    // If we find at least one, emit true, otherwise complete without emitting (defaultIfEmpty handles this)
    map(() => true),
    // Take only the first emission (we just need to know if *any* exist)
    take(1),
    // If the stream completes without emitting (no .java files found), emit false
    defaultIfEmpty(false),
    catchError((err) => {
      console.error(
        `Error reading directory ${dir} for Java files: ${err.message}`
      );
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
      // Use concat to ensure current directory is emitted before exploring subdirectories fully
      return concat(currentDir$, subPackages$);
    })
  );
}

// getProjectDependenciesRx: Modified to emit PackageDepsReport incrementally
function getProjectDependenciesRx(projectSrcFolder) {
  // findPackageDirectoriesRx emits package directory paths one by one
  return findPackageDirectoriesRx(projectSrcFolder).pipe(
    // For each package directory found, get its consolidated PackageDepsReport
    mergeMap(
      (packageDir) => getPackageDependenciesRxForProjectDeps(packageDir) // This now emits PackageDepsReport objects
    ),
    // No need to collect into ProjectDepsReport here, as we are emitting PackageDepsReport incrementally
    catchError((error) => {
      // Catch errors from findPackageDirectoriesRx or downstream getPackageDependenciesRx
      console.error(
        `Error analyzing project ${projectSrcFolder}: ${error.message}`
      );
      // Decide how to handle project-level errors.
      return throwError(
        () =>
          new Error(
            `Error analyzing project ${projectSrcFolder}: ${error.message}`
          )
      );
      // Or return EMPTY to just stop emitting
      // return EMPTY;
    })
    // We are now emitting a stream of PackageDepsReport objects
  );
}

export {
  getClassDependenciesRx,
  getPackageDependenciesRx,
  getProjectDependenciesRx,
  ClassDepsReport,
  PackageDepsReport, // Ensure this is exported
  ProjectDepsReport,
};
