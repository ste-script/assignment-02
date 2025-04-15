import { getClassDependencies, getPackageDependencies, getProjectDependencies } from "../src/main.js";
import fs from "fs/promises";

async function runTests() {
  try {
    //create files if not exist
    await fs.mkdir("../testReport", { recursive: true });

    // Test getClassDependencies
    const classReport = await getClassDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/ApplicationRunner.java"
    );
    console.log("Class Dependencies Report:");
    await fs.writeFile("../testReport/classReport.json", JSON.stringify(classReport, null, 2));

    // Test getPackageDependencies
    const packageReport = await getPackageDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot/admin"
    );
    console.log("\nPackage Dependencies Report:");
    await fs.writeFile("../testReport/packageReport.json", JSON.stringify(packageReport, null, 2));

    // Test getProjectDependencies
    const projectReport = await getProjectDependencies(
      "../resources/spring-boot/spring-boot-project/spring-boot/src/main/java/org/springframework/boot"
    );
    console.log("\nProject Dependencies Report:");
    await fs.writeFile("../testReport/projectReport.json", JSON.stringify(projectReport, null, 2));
    
  } catch (error) {
    console.error("Test Error:", error);
  }
}

runTests();
