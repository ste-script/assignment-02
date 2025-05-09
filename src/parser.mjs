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
    this.customResult = new Set(); // Use a Set to store unique *fully qualified* type strings
    this.currentPackage = ""; // Store the package of the current file
    this.currentClassSimpleName = ""; // Store the simple name of the current class
    this.currentClassFQN = ""; // Store the fully qualified name of the current class
    this.singleTypeImports = new Map(); // Maps simple name to fully qualified name
    this.onDemandImports = new Set(); // Stores package prefixes for '*' imports
    this.validateVisitor();
  }

  // Store package declaration
  packageDeclaration(ctx) {
    if (ctx.Identifier) {
      this.currentPackage = ctx.Identifier.map((id) => id.image).join(".");
    }
    // No need to call super.packageDeclaration(ctx); as we don't need to visit deeper
  }

  importDeclaration(ctx) {
    // export type ImportDeclarationCtx = {
    //   Import?: IToken[];
    //   Static?: IToken[];
    //   packageOrTypeName?: PackageOrTypeNameCstNode[];
    //   Dot?: IToken[];
    //   Star?: IToken[];
    //   Semicolon?: IToken[];
    //   emptyStatement?: EmptyStatementCstNode[];
    // };
    // Check for static imports.
    if (ctx.Static && ctx.Static.length > 0) {
      // Static imports are ignored for type dependency analysis for now
      // No need to call super.importDeclaration(ctx);
      return;
    }

    // Process non-static imports (single type or on-demand).
    // These should have 'packageOrTypeName'.
    if (ctx.packageOrTypeName && ctx.packageOrTypeName.length > 0) {
      const nameNode = ctx.packageOrTypeName[0]; // This is a PackageOrTypeNameCstNode

      // Ensure the nameNode and its children (Identifiers) are valid
      if (
        nameNode.children &&
        nameNode.children.Identifier &&
        nameNode.children.Identifier.length > 0
      ) {
        const identifiers = nameNode.children.Identifier;
        const qualifiedName = identifiers.map((id) => id.image).join(".");

        // Differentiate based on the presence of a Star token
        if (ctx.Star && ctx.Star.length > 0) {
          // TypeImportOnDemandDeclaration (e.g., import java.util.*;)
          this.onDemandImports.add(qualifiedName);
        } else {
          // SingleTypeImportDeclaration (e.g., import java.util.List;)
          // The absence of Star (and Static) indicates a single type import.
          const simpleName = identifiers[identifiers.length - 1].image;
          this.singleTypeImports.set(simpleName, qualifiedName);
        }
      }
    }
    // No need to call super.importDeclaration(ctx) as we've processed the import.
  }

  // Helper to resolve and add a type string if it's valid and not primitive/simple
  addType(typeString) {
    if (
      !typeString ||
      typeof typeString !== "string" ||
      typeString.trim() === ""
    ) {
      return; // Ignore invalid input
    }

    // Clean up array brackets for resolution logic
    const isArray = typeString.endsWith("[]");
    const baseTypeString = isArray
      ? typeString.substring(0, typeString.length - 2)
      : typeString;

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
      "var",
      "Object",
      "Exception",
      "String",
    ];
    if (primitives.includes(baseTypeString)) {
      return; // Don't add primitive types
    }

    // Attempt to resolve the type to a fully qualified name
    let resolvedType = baseTypeString;
    if (baseTypeString.includes("java.lang")) {
      return; // Don't add java.lang classes, they are implicitly available
    }
    // 1. Check if it's already qualified
    if (baseTypeString.includes(".")) {
      resolvedType = baseTypeString;
    }
    // 2. Check single-type imports
    else if (this.singleTypeImports.has(baseTypeString)) {
      resolvedType = this.singleTypeImports.get(baseTypeString);
    }
    // 4. Check if it's potentially in the same package
    // This assumption is only made if there are no on-demand imports that could provide the type.
    else if (
      this.onDemandImports.size === 0 && // Check if there are no on-demand imports
      this.currentPackage !== "" &&
      baseTypeString !== this.currentClassSimpleName
    ) {
      resolvedType = this.currentPackage + "." + baseTypeString;
    }
    // 5. Check against on-demand imports
    else if (this.onDemandImports.size > 0) {
      // If we have on-demand imports, we can make a reasonable guess
      if (this.onDemandImports.size === 1) {
        // If there's only one on-demand import, we can be more confident
        const onDemandPackage = Array.from(this.onDemandImports)[0];
        resolvedType = onDemandPackage + "." + baseTypeString;
      } else {
        // Multiple on-demand imports - we'll mention the first one but note there are others
        const onDemandPackages = Array.from(this.onDemandImports);
        resolvedType = onDemandPackages[0] + "." + baseTypeString + 
                      ` (potentially from ${onDemandPackages.length} on-demand imports)`;
      }
    }
    // 6. Fallback: Could be from an on-demand import or truly unresolved.
    else {
      // If baseTypeString is the simple name of the current class, and it hasn't been resolved
      // by prior rules (e.g. it wasn't used as FQN), it's not an external dependency to add.
      if (
        baseTypeString === this.currentClassSimpleName &&
        !baseTypeString.includes(".")
      ) {
        return; // Do not add the class itself as a dependency through this path.
      }

      // At this point, it's likely truly unresolved
      console.error(
        `Warning: Unable to resolve type "${baseTypeString}" in class ${this.currentClassFQN}. No matching imports found.`
      );
      resolvedType = baseTypeString + " (unresolved)"; // Mark as unresolved for clarity
    }

    // Basic validation for the resolved type structure
    // Ensure the resolvedType (before adding " (unresolved)" or "[]") is a valid Java identifier part.
    // The regex needs to account for the " (unresolved)" marker if we test finalType,
    // or we test resolvedType before appending the marker. Let's test before marker.
    const typeToValidate = resolvedType.replace(" (unresolved)", "");
    if (typeToValidate && /^[a-zA-Z0-9_$.]+$/.test(typeToValidate)) {
      // Add back array brackets if necessary
      const finalType = isArray ? resolvedType + "[]" : resolvedType;
      // Prevent adding the current class FQN as a dependency of itself
      if (
        finalType === this.currentClassFQN ||
        finalType === this.currentClassFQN + "[]"
      ) {
        return;
      }
      this.customResult.add(finalType);
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
    if (
      ctx.typeIdentifier &&
      ctx.typeIdentifier[0] &&
      ctx.typeIdentifier[0].children.Identifier &&
      ctx.typeIdentifier[0].children.Identifier[0]
    ) {
      const simpleName = ctx.typeIdentifier[0].children.Identifier[0].image;
      this.currentClassSimpleName = simpleName;
      if (this.currentPackage && this.currentPackage !== "") {
        this.currentClassFQN = this.currentPackage + "." + simpleName;
      } else {
        this.currentClassFQN = simpleName; // Class in default package
      }
      // Note: We don't add this.currentClassFQN to this.customResult via this.addType()
      // because a class is not a dependency of itself.
      // This FQN is primarily for identifying the class being analyzed.
    }

    // Extends
    if (
      ctx.superclass &&
      ctx.superclass[0] &&
      ctx.superclass[0].children.classType &&
      ctx.superclass[0].children.classType[0]
    ) {
      this.addType(
        this.extractTypeString(ctx.superclass[0].children.classType[0])
      );
    }

    // Implements
    if (
      ctx.superinterfaces &&
      ctx.superinterfaces[0] &&
      ctx.superinterfaces[0].children.interfaceTypeList &&
      ctx.superinterfaces[0].children.interfaceTypeList[0] &&
      ctx.superinterfaces[0].children.interfaceTypeList[0].children
        .interfaceType
    ) {
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

    // Parameters
    if (
      ctx.methodHeader &&
      ctx.methodHeader[0].children.formalParameterList &&
      ctx.methodHeader[0].children.formalParameterList[0] &&
      ctx.methodHeader[0].children.formalParameterList[0].children
        .formalParameter
    ) {
      ctx.methodHeader[0].children.formalParameterList[0].children.formalParameter.forEach(
        (param) => {
          console.log("Visiting parameter:", param);
          this.visit(param); // This will call the formalParameter visitor
        }
      );
    } else if (
      ctx.methodHeader &&
      ctx.methodHeader[0].children.formalParameterList &&
      ctx.methodHeader[0].children.formalParameterList[0] &&
      ctx.methodHeader[0].children.formalParameterList[0].children
        .lastFormalParameter &&
      ctx.methodHeader[0].children.formalParameterList[0].children
        .lastFormalParameter[0]
    ) {
      // Handle varargs (lastFormalParameter)
      this.visit(
        ctx.methodHeader[0].children.formalParameterList[0].children
          .lastFormalParameter[0]
      );
    }

    // Throws
    /*if (ctx.methodHeader && ctx.methodHeader[0].children.throws) {
      ctx.methodHeader[0].children.throws[0].children.exceptionTypeList[0].children.exceptionType.forEach(
        (exType) => {
          this.addType(this.extractTypeString(exType));
        }
      );
    }*/
    super.methodDeclaration(ctx); // Visit parameters and body
  }

  // Visiting formal parameters specifically
  formalParameter(ctx) { // ctx is FormalParameterCtx
    let parameterNode; // This will be VariableParaRegularParameterCstNode or VariableArityParameterCstNode

    if (ctx.variableParaRegularParameter && ctx.variableParaRegularParameter.length > 0) {
      parameterNode = ctx.variableParaRegularParameter[0];
    } else if (ctx.variableArityParameter && ctx.variableArityParameter.length > 0) {
      parameterNode = ctx.variableArityParameter[0];
    }

    // parameterNode is a CstNode (e.g., VariableParaRegularParameterCstNode).
    // Its 'children' property (e.g., VariableParaRegularParameterCtx) contains 'unannType'.
    if (parameterNode && parameterNode.children && parameterNode.children.unannType && parameterNode.children.unannType.length > 0) {
      const unannTypeNode = parameterNode.children.unannType[0]; // This is UnannTypeCstNode
      this.addType(this.extractTypeString(unannTypeNode));
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
    if (
      ctx &&
      ctx.localVariableType &&
      ctx.localVariableType[0]?.children?.unannType &&
      ctx.localVariableType[0].children.unannType[0]
    ) {
      this.addType(
        this.extractTypeString(ctx.localVariableType[0].children.unannType[0])
      );
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
