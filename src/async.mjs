import { promises as fs } from "fs";
import { basename, join } from "path";
import { parse, BaseJavaCstVisitorWithDefaults } from "java-parser";

class ClassDepsReport {
  constructor(className, usedTypes) {
    this.className = className;
    this.usedTypes = usedTypes; // Array of { type: string, package: string }
  }
}

class PackageDepsReport {
  constructor(packageName, classReports) {
    this.packageName = packageName;
    this.classReports = classReports;
  }
}

class ProjectDepsReport {
  constructor(projectName, packageReports) {
    this.projectName = projectName;
    this.packageReports = packageReports;
  }
}

async function getClassDependencies(classSrcFile) {
  try {
    const content = await fs.readFile(classSrcFile, "utf8");
    const ast = parse(content);
    const usedTypes = await extractDependenciesFromAST(ast);
    const className = basename(classSrcFile, ".java");
    return new ClassDepsReport(className, usedTypes);
  } catch (error) {
    throw new Error(`Error analyzing class ${classSrcFile}: ${error.message}`);
  }
}

async function getPackageDependencies(packageSrcFolder, unique = false) {
  try {
    const files = await fs.readdir(packageSrcFolder);
    const javaFiles = files
      .filter((file) => file.endsWith(".java"))
      .map((file) => join(packageSrcFolder, file));
    const classReports = await Promise.all(
      javaFiles.map((file) => getClassDependencies(file))
    );
    const packageName = basename(packageSrcFolder);
    if (unique) {
      const flattenedTypes = classReports.flatMap((report) => report.usedTypes);
      const deduplicatedTypes = await deduplicateTypes(flattenedTypes);
      return new PackageDepsReport(packageName, deduplicatedTypes);
    }
    return new PackageDepsReport(packageName, classReports);
  } catch (error) {
    throw new Error(
      `Error analyzing package ${packageSrcFolder}: ${error.message}`
    );
  }
}

async function getProjectDependencies(projectSrcFolder, unique = false) {
  try {
    const packageDirs = await findPackageDirectories(projectSrcFolder);
    const packageReports = await Promise.all(
      packageDirs.map((dir) => getPackageDependencies(dir))
    );
    const projectName = basename(projectSrcFolder);
    if (unique) {
      const flattenedTypes = packageReports.flatMap((report) =>
        report.classReports.flatMap((classReport) => classReport.usedTypes)
      );
      const deduplicatedTypes = await deduplicateTypes(flattenedTypes);
      return new ProjectDepsReport(projectName, deduplicatedTypes);
    }
    return new ProjectDepsReport(projectName, packageReports);
  } catch (error) {
    throw new Error(
      `Error analyzing project ${projectSrcFolder}: ${error.message}`
    );
  }
}

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

async function extractDependenciesFromAST(ast) {
  const types = new Set();
  const visitorCollector = new DependecyAnalyserCstVisitor();
  visitorCollector.visit(ast);
  const customResult = visitorCollector.customResult;
  customResult.forEach((type) => {
    types.add(type);
  });
  const result = Array.from(types).map((type) => {
    const { type: typeName, package: packageName } = type;
    return {
      type: typeName,
      package: packageName,
    };
  });
  return result;
}

async function deduplicateTypes(types) {
  const seen = new Set();
  return types.filter((t) => {
    const key = `${t.package}.${t.type}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function findPackageDirectories(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let packages = [];
  let hasJavaFile = false;

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subPackages = await findPackageDirectories(fullPath);
      packages.push(...subPackages);
    } else if (entry.isFile() && entry.name.endsWith(".java")) {
      hasJavaFile = true;
    }
  }

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
