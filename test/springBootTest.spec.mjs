import path from "path";
import {
    getClassDependencies,
    getPackageDependencies,
    getProjectDependencies,
} from "../src/main.mjs";
import fs from "fs/promises";

const baseFolder = path.join("..", "testReport");

async function runTests(unique) {
    const compositeFolder = path.join(baseFolder, unique ? "unique" : "all");
    try {
        // Create directories if they don't exist
        await fs.mkdir(compositeFolder, { recursive: true });
        const classFilename = "classReport.json";
        const packageFilename = "packageReport.json";
        const projectFilename = "projectReport.json";

        // Test getClassDependencies
        const classPromise = getClassDependencies(
            path.join(
                "..",
                "resources",
                "spring-boot",
                "spring-boot-project",
                "spring-boot",
                "src",
                "main",
                "java",
                "org",
                "springframework",
                "boot",
                "ApplicationRunner.java"
            ),
            unique
        );
        const packagePromise = getPackageDependencies(
            path.join(
                "..",
                "resources",
                "spring-boot",
                "spring-boot-project",
                "spring-boot",
                "src",
                "main",
                "java",
                "org",
                "springframework",
                "boot",
                "admin"
            ),
            unique
        );
        const projectPromise = getProjectDependencies(
            path.join(
                "..",
                "resources",
                "spring-boot",
                "spring-boot-project",
                "spring-boot",
                "src",
                "main",
                "java",
                "org",
                "springframework",
                "boot"
            ),
            unique
        );
        const [classResult, packageResult, projectResult] = await Promise.all([
            classPromise,
            packagePromise,
            projectPromise,
        ]);

        writeToFile(path.join(compositeFolder, classFilename), classResult).then(() => {
            console.log("Class Dependencies Report written to file.");
        });
        writeToFile(path.join(compositeFolder, packageFilename), packageResult).then(() => {
            console.log("Package Dependencies Report written to file.");
        });
        writeToFile(path.join(compositeFolder, projectFilename), projectResult).then(() => {
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
