import {
  getClassDependencies,
  getPackageDependencies,
  getProjectDependencies,
} from "../src/main.js";
import fs from "fs/promises";
const baseFolder = "../testReport/";
async function runTests(unique) {
  const compositeFolder = baseFolder + (unique ? "unique/" : "all/");
  try {
    //create files if not exist
    await fs.mkdir(compositeFolder, { recursive: true });

    // Test getClassDependencies
    const classReport = await getClassDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/ApplicationRunner.java",
      unique
    );
    console.log("Class Dependencies Report:");
    await fs.writeFile(
      compositeFolder + "classReport.json",
      JSON.stringify(classReport, null, 2)
    );

    // Test getPackageDependencies
    const packageReport = await getPackageDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/admin",
      unique
    );
    console.log("\nPackage Dependencies Report:");
    await fs.writeFile(
      compositeFolder + "packageReport.json",
      JSON.stringify(packageReport, null, 2)
    );

    // Test getProjectDependencies
    const projectReport = await getProjectDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot",
      unique
    );
    console.log("\nProject Dependencies Report:");
    await fs.writeFile(
      compositeFolder + "projectReport.json",
      JSON.stringify(projectReport, null, 2)
    );
  } catch (error) {
    console.error("Test Error:", error);
  }
}

runTests(false);
runTests(true);
