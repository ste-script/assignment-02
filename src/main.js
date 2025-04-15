const fs = require("fs").promises;
const path = require("path");
const { parse, BaseJavaCstVisitorWithDefaults } = require("java-parser");

class ClassDepsReport {
  constructor(className, usedTypes) {
    this.className = className;
    this.usedTypes = usedTypes; // Array of { type: string, package: string }
  }
}

class PackageDepsReport {
  constructor(packageName, usedTypes) {
    this.packageName = packageName;
    this.usedTypes = usedTypes;
  }
}

class ProjectDepsReport {
  constructor(usedTypes) {
    this.usedTypes = usedTypes;
  }
}

async function getClassDependencies(classSrcFile) {
  try {
    const content = await fs.readFile(classSrcFile, "utf8");
    const ast = parse(content);
    const usedTypes = extractDependenciesFromAST(ast);
    const className = path.basename(classSrcFile, ".java");
    return new ClassDepsReport(className, usedTypes);
  } catch (error) {
    throw new Error(`Error analyzing class ${classSrcFile}: ${error.message}`);
  }
}

async function getPackageDependencies(packageSrcFolder) {
  try {
    const files = await fs.readdir(packageSrcFolder);
    const javaFiles = files
      .filter((file) => file.endsWith(".java"))
      .map((file) => path.join(packageSrcFolder, file));
    const classReports = await Promise.all(
      javaFiles.map((file) => getClassDependencies(file))
    );
    const allUsedTypes = classReports.flatMap((report) => report.usedTypes);
    const uniqueTypes = deduplicateTypes(allUsedTypes);
    const packageName = path.basename(packageSrcFolder);
    return new PackageDepsReport(packageName, uniqueTypes);
  } catch (error) {
    throw new Error(
      `Error analyzing package ${packageSrcFolder}: ${error.message}`
    );
  }
}

async function getProjectDependencies(projectSrcFolder) {
  try {
    const packageDirs = await findPackageDirectories(projectSrcFolder);
    const packageReports = await Promise.all(
      packageDirs.map((dir) => getPackageDependencies(dir))
    );
    const allUsedTypes = packageReports.flatMap((report) => report.usedTypes);
    const uniqueTypes = deduplicateTypes(allUsedTypes);
    return new ProjectDepsReport(uniqueTypes);
  } catch (error) {
    throw new Error(
      `Error analyzing project ${projectSrcFolder}: ${error.message}`
    );
  }
}

class DependecyAnalyserLib extends BaseJavaCstVisitorWithDefaults {
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

  // Extract class or interface type references
  classOrInterfaceType(ctx) {
    if (ctx.children && ctx.children.Identifier) {
      const identifiers = ctx.children.Identifier;
      if (identifiers.length > 0) {
        const typeName = identifiers[identifiers.length - 1].image;
        let packageName = "default";

        if (identifiers.length > 1) {
          packageName = identifiers
            .slice(0, identifiers.length - 1)
            .map((id) => id.image)
            .join(".");
        }

        this.customResult.push({ type: typeName, package: packageName });
      }
    }
  }

  // Extract types from object creation expressions
  creator(ctx) {
    if (ctx.createdName && ctx.createdName[0].children.Identifier) {
      const identifiers = ctx.createdName[0].children.Identifier;
      if (identifiers.length > 0) {
        const typeName = identifiers[identifiers.length - 1].image;
        let packageName = "default";

        if (identifiers.length > 1) {
          packageName = identifiers
            .slice(0, identifiers.length - 1)
            .map((id) => id.image)
            .join(".");
        }

        this.customResult.push({ type: typeName, package: packageName });
      }
    }
  }
}

function extractDependenciesFromAST(ast) {
  const types = new Set();
  const visitorCollector = new DependecyAnalyserLib();
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

function deduplicateTypes(types) {
  const seen = new Set();
  return types.filter((t) => {
    const key = `${t.package}.${t.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });
}

async function findPackageDirectories(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let packages = [];
  let hasJavaFile = false;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
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

module.exports = {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
  ClassDepsReport,
  PackageDepsReport,
  ProjectDepsReport,
};
