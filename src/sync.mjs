import fs from "fs";
import { basename, join } from "path";
import {
  DependecyAnalyserCstVisitor,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
} from "./parser.mjs";
import { parse } from "java-parser";

function getClassDependencies(classSrcFile) {
  const content = fs.readFileSync(classSrcFile, "utf8");
  const ast = parse(content);
  const usedTypes = extractDependenciesFromAST(ast);
  const className = basename(classSrcFile, ".java");
  // Filter out the class's own name from its dependencies
  const ownNameRegex = new RegExp(`(^|\\.)${className}$`);
  const filteredTypes = usedTypes.filter((type) => !ownNameRegex.test(type));
  return new ClassDepsReport(className, filteredTypes);
}

function getPackageDependencies(packageSrcFolder, unique = false) {
  const files = fs.readdirSync(packageSrcFolder);
  const javaFiles = files
    .filter((file) => file.endsWith(".java"))
    .map((file) => join(packageSrcFolder, file));

  // Handle potential errors during individual class analysis
  const classReportPromises = javaFiles.map((file) =>
    getClassDependencies(file)
  );
  const classReports = classReportPromises.filter((report) => report !== null); // Filter out failed analyses

  const packageName = basename(packageSrcFolder);
  if (unique) {
    const flattenedTypes = classReports.flatMap((report) => report.usedTypes);
    const uniqueTypes = Array.from(new Set(flattenedTypes));
    return new PackageDepsReport(packageName, uniqueTypes); // Pass unique types array
  }
  return new PackageDepsReport(packageName, classReports); // Pass class reports array
}

function getProjectDependencies(projectSrcFolder, unique = false) {
  try {
    const packageDirs = findPackageDirectories(projectSrcFolder);

    // Handle potential errors during individual package analysis
    const packageReportPromises = packageDirs.map((dir) =>
      getPackageDependencies(dir, false)
    );
    const packageReports = packageReportPromises.filter(
      (report) => report !== null
    );

    const projectName = basename(projectSrcFolder);
    if (unique) {
      // Flatten all type strings from all class reports in all package reports
      const flattenedTypes = packageReports.flatMap((pkgReport) =>
        pkgReport.classReports.flatMap((clsReport) => clsReport.usedTypes)
      );
      const uniqueTypes = Array.from(new Set(flattenedTypes));
      return new ProjectDepsReport(projectName, uniqueTypes); // Pass unique types array
    }
    return new ProjectDepsReport(projectName, packageReports); // Pass package reports array
  } catch (error) {
    console.error(
      `Error analyzing project ${projectSrcFolder}: ${error.message}`
    );
    // Return an empty report or re-throw
    return new ProjectDepsReport(basename(projectSrcFolder), []);
    // throw new Error(
    //   `Error analyzing project ${projectSrcFolder}: ${error.message}`
    // );
  }
}

function extractDependenciesFromAST(ast) {
  const visitorCollector = new DependecyAnalyserCstVisitor();
  visitorCollector.visit(ast);
  // Return the unique type strings collected
  return Array.from(visitorCollector.customResult);
}

// findPackageDirectories remains the same
function findPackageDirectories(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let packages = [];
  let hasJavaFile = false;

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Avoid recursing into hidden directories or common build/target folders
      if (
        !entry.name.startsWith(".") &&
        !["target", "build", "out", "bin"].includes(entry.name)
      ) {
        const subPackages = findPackageDirectories(fullPath);
        packages.push(...subPackages);
      }
    } else if (entry.isFile() && entry.name.endsWith(".java")) {
      hasJavaFile = true;
    }
  }

  // Only consider a directory a package if it directly contains Java files
  if (hasJavaFile) {
    packages.push(dir);
  }

  return packages;
}

export {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
};
