import { BaseJavaCstVisitorWithDefaults } from "java-parser";

export class ClassDepsReport {
  constructor(className, usedTypes) {
    this.className = className;
    this.usedTypes = usedTypes; // Array of strings representing used types
  }
}

export class PackageDepsReport {
  constructor(packageName, reportsOrTypes) {
    // reportsOrTypes can be classReports array or unique types array
    this.packageName = packageName;
    // Distinguish based on input type
    if (
      Array.isArray(reportsOrTypes) &&
      reportsOrTypes.length > 0 &&
      typeof reportsOrTypes[0] === "string"
    ) {
      this.uniqueUsedTypes = reportsOrTypes; // Store unique types directly
      this.classReports = []; // Keep structure consistent, even if empty when unique
    } else {
      this.classReports = reportsOrTypes || [];
      this.uniqueUsedTypes = null;
    }
  }
}

export class ProjectDepsReport {
  constructor(projectName, reportsOrTypes) {
    // reportsOrTypes can be packageReports array or unique types array
    this.projectName = projectName;
    if (
      Array.isArray(reportsOrTypes) &&
      reportsOrTypes.length > 0 &&
      typeof reportsOrTypes[0] === "string"
    ) {
      this.uniqueUsedTypes = reportsOrTypes;
      this.packageReports = []; // Keep structure consistent
    } else {
      this.packageReports = reportsOrTypes || [];
      this.uniqueUsedTypes = null;
    }
  }
}

export class DependecyAnalyserCstVisitor extends BaseJavaCstVisitorWithDefaults {
  constructor() {
    super();
    this.customResult = new Set(); // Use a Set to store unique type strings
    this.validateVisitor();
  }

  // Helper to add a type string if it's valid and not primitive/simple
  addType(typeString) {
    if (
      typeString &&
      typeof typeString === "string" &&
      typeString.trim() !== ""
    ) {
      // Basic check to avoid adding noise like punctuation if extraction fails
      // Avoid adding primitive types or void for dependency tracking
      const primitives = [
        "void",
        "byte",
        "short",
        "int",
        "long",
        "float",
        "double",
        "boolean",
        "char",
      ];
      if (
        !primitives.includes(typeString) &&
        /^[a-zA-Z0-9_$.<>\[\]]+$/.test(typeString)
      ) {
        // Further check: avoid adding single uppercase letters (likely generics like T, E, K, V)
        if (typeString.length > 1 || typeString !== typeString.toUpperCase()) {
          this.customResult.add(typeString);
        }
      }
    }
  }

  // Helper to extract type string from common type structures in CST
  extractTypeString(typeNode) {
    if (!typeNode || !typeNode.children) return null;

    // Prioritize Identifier for class/interface types
    if (typeNode.children.Identifier) {
      return typeNode.children.Identifier.map((id) => id.image).join(".");
    }
    // Handle primitive types
    if (typeNode.children.primitiveType) {
      const primitive = typeNode.children.primitiveType[0];
      const keys = Object.keys(primitive.children);
      if (
        keys.length > 0 &&
        primitive.children[keys[0]] &&
        primitive.children[keys[0]][0]
      ) {
        return primitive.children[keys[0]][0].image;
      }
    }
    // Handle void
    if (typeNode.children.Void) return "void";

    // Recurse down common wrapper nodes if no direct type found yet
    const keys = Object.keys(typeNode.children);
    if (
      keys.length === 1 &&
      typeNode.children[keys[0]] &&
      typeNode.children[keys[0]][0]
    ) {
      // Avoid infinite recursion on self-referential wrappers if any exist
      if (typeNode.children[keys[0]][0] !== typeNode) {
        return this.extractTypeString(typeNode.children[keys[0]][0]);
      }
    }
    // Handle array types (e.g., String[]) - adds '[]'
    if (typeNode.children.dims && typeNode.children.dims[0]) {
      const baseTypeNode = keys.filter((k) => k !== "dims")[0];
      if (
        baseTypeNode &&
        typeNode.children[baseTypeNode] &&
        typeNode.children[baseTypeNode][0]
      ) {
        const baseType = this.extractTypeString(
          typeNode.children[baseTypeNode][0]
        );
        if (baseType) {
          // Simplified: just append [] for now. Real arrays are complex.
          return baseType + "[]";
        }
      }
    }

    return null; // Indicate type couldn't be extracted
  }

  // 1. Class/Interface Declaration Name & Extends/Implements
  normalClassDeclaration(ctx) {
    // Own name (useful for context, but filtered later)
    if (ctx.typeIdentifier) {
      const identifier = ctx.typeIdentifier[0].children.Identifier[0];
      // this.addType(identifier.image); // Don't add self as dependency
    }
    // Extends
    if (ctx.superclass) {
      this.addType(
        this.extractTypeString(ctx.superclass[0].children.classType[0])
      );
    }
    // Implements
    if (ctx.superinterfaces) {
      ctx.superinterfaces[0].children.interfaceTypeList[0].children.interfaceType.forEach(
        (intType) => {
          this.addType(this.extractTypeString(intType));
        }
      );
    }
    super.normalClassDeclaration(ctx); // Visit fields, methods etc.
  }

  normalInterfaceDeclaration(ctx) {
    // Own name
    // if (ctx.typeIdentifier) { ... }
    // Extends
    if (ctx.extendsInterfaces) {
      ctx.extendsInterfaces[0].children.interfaceTypeList[0].children.interfaceType.forEach(
        (intType) => {
          this.addType(this.extractTypeString(intType));
        }
      );
    }
    super.normalInterfaceDeclaration(ctx);
  }

  // 3. Field Declaration Type
  fieldDeclaration(ctx) {
    if (ctx.unannType) {
      this.addType(this.extractTypeString(ctx.unannType[0]));
    }
    super.fieldDeclaration(ctx); // Visit initializers
  }

  // 4. Method Declaration Types (Params & Return)
  methodDeclaration(ctx) {
    // Return Type
    if (ctx.methodHeader && ctx.methodHeader[0].children.result) {
      this.addType(
        this.extractTypeString(ctx.methodHeader[0].children.result[0])
      );
    }
    // Throws
    if (ctx.methodHeader && ctx.methodHeader[0].children.throws) {
      ctx.methodHeader[0].children.throws[0].children.exceptionTypeList[0].children.exceptionType.forEach(
        (exType) => {
          this.addType(this.extractTypeString(exType));
        }
      );
    }
    super.methodDeclaration(ctx); // Visit parameters and body
  }

  // Visiting formal parameters specifically
  formalParameter(ctx) {
    if (ctx.unannType) {
      this.addType(this.extractTypeString(ctx.unannType[0]));
    }
    super.formalParameter(ctx);
  }

  // 5. Object Creation Type
  unqualifiedClassInstanceCreationExpression(ctx) {
    if (ctx.classOrInterfaceTypeToInstantiate) {
      this.addType(
        this.extractTypeString(ctx.classOrInterfaceTypeToInstantiate[0])
      );
    }
    super.unqualifiedClassInstanceCreationExpression(ctx); // Visit arguments
  }

  // 6. Variable Declaration Type
  localVariableDeclaration(ctx) {
    if (ctx.unannType) {
      this.addType(this.extractTypeString(ctx.unannType[0]));
    }
    super.localVariableDeclaration(ctx); // Visit initializers
  }

  // 7. Type Arguments (Generics like List<String>)
  typeArguments(ctx) {
    if (ctx.typeArgumentList && ctx.typeArgumentList[0].children.typeArgument) {
      ctx.typeArgumentList[0].children.typeArgument.forEach((arg) => {
        // typeArgument can be referenceType or wildcard
        if (arg.children.referenceType) {
          this.addType(this.extractTypeString(arg.children.referenceType[0]));
        }
      });
    }
    super.typeArguments(ctx);
  }

  // 8. Import Declaration
  importDeclaration(ctx) {
    if (ctx.packageOrTypeName) {
      const name = ctx.packageOrTypeName[0].children.Identifier.map(
        (i) => i.image
      ).join(".");
      this.addType(name); // Add the full import path
    } else if (ctx.typeName) {
      // Single type import
      const name = ctx.typeName[0].children.Identifier.map((i) => i.image).join(
        "."
      );
      this.addType(name);
    }
    // Don't call super, we've handled it.
  }

  // Catch explicit type usages (e.g., casts, instanceof, static calls, annotations)
  annotation(ctx) {
    if (ctx.typeName) {
      this.addType(this.extractTypeString(ctx.typeName[0]));
    }
    super.annotation(ctx);
  }

  castExpression(ctx) {
    // Type is in ctx.expression[0] for primitive casts,
    // or ctx.referenceType[0] for reference type casts
    if (ctx.primitiveType) {
      this.addType(this.extractTypeString(ctx.primitiveType[0]));
    } else if (ctx.referenceType) {
      this.addType(this.extractTypeString(ctx.referenceType[0]));
      // Also visit potential type arguments within referenceType
      if (
        ctx.referenceType[0].children.classOrInterfaceType &&
        ctx.referenceType[0].children.classOrInterfaceType[0].children
          .typeArguments
      ) {
        this.visit(
          ctx.referenceType[0].children.classOrInterfaceType[0].children
            .typeArguments
        );
      }
    }
    super.castExpression(ctx);
  }

  // This catches types used in static calls (e.g., Collections.sort) or field access
  typeName(ctx) {
    if (ctx.Identifier) {
      this.addType(ctx.Identifier.map((id) => id.image).join("."));
    }
    super.typeName(ctx);
  }

  // Catch types used directly, e.g., as variable types, parameter types, etc.
  // This might be redundant with field/local var/param visitors but acts as a fallback.
  classOrInterfaceType(ctx) {
    if (ctx.Identifier) {
      this.addType(ctx.Identifier.map((id) => id.image).join("."));
    }
    // Visit type arguments if present
    if (ctx.typeArguments) {
      this.visit(ctx.typeArguments);
    }
    // Don't call super here to avoid potential duplicate visits from parent nodes
  }
}
