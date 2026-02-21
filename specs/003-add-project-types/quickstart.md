# Quickstart — Creating a Project from a Project Type

1. Open the app and navigate to the Start page.
2. Click "Create Project" to open the Create Project modal.
3. Select a Project Type from the dropdown (templates loaded from `getwrite-config/templates/project-types`).
4. Enter a project name and click Create.
5. The app will call `createProjectFromType(name, projectTypeId)` and open the newly-created project. The Resource Tree will display the folders and default resources declared by the Project Type.

Developer notes:

- Project Type templates are JSON files in `getwrite-config/templates/project-types`.
- If the modal shows "No project types available", verify the templates directory exists and contains valid JSON files.
- To debug creation: inspect `frontend/src/lib/models/project-creator.ts` for `createProjectFromType` implementation and add logging.
