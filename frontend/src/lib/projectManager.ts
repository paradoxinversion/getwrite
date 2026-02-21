import { Project } from "./models";

export async function getProjectResources(project: Project) {
    const projectPath = project.rootPath;
    const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            projectPath,
        }),
    });
}
