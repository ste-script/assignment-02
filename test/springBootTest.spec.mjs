import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
} from "../src/main.mjs";
import fs from "fs/promises";
const baseFolder = "../testReport/";

async function runTests(unique) {
  const compositeFolder = baseFolder + (unique ? "unique/" : "all/");
  try {
    //create files if not exist
    await fs.mkdir(compositeFolder, { recursive: true });
    const classFilename = "classReport.json";
    const packageFilename = "packageReport.json";
    const projectFilename = "projectReport.json";

    // Test getClassDependencies
    const classPromise = getClassDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/ApplicationRunner.java",
      unique
    );
    const packagePromise = getPackageDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/admin",
      unique
    );
    const projectPromise = getProjectDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot",
      unique
    );
    const [classResult, packageResult, projectResult] = await Promise.all([
      classPromise,
      packagePromise,
      projectPromise,
    ]);

    writeToFile(compositeFolder + classFilename, classResult).then(() => {
      console.log("Class Dependencies Report written to file.");
    });
    writeToFile(compositeFolder + packageFilename, packageResult).then(() => {
      console.log("Package Dependencies Report written to file.");
    });
    writeToFile(compositeFolder + projectFilename, projectResult).then(() => {
      console.log("Project Dependencies Report written to file.");
    });
  } catch (error) {
    console.error("Test Error:", error);
  }
}

async function writeToFile(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

runTests(false);
runTests(true);
