Project Type Templates

This directory contains JSON templates for common project types used by GetWrite. Each template conforms to the project type schema at `specs/002-define-data-models/project-types/project-type.schema.json` and can be used to scaffold a new project.

Templates included

- `blank_project_type.json` — Blank
    - Minimal project containing only a `Workspace` folder. Useful for starting from scratch.

- `novel_project_type.json` — Novel
    - Intended for long-form fiction. Includes `Workspace`, `Drafts`, `Research`, and `Assets`. Seeds a `Manuscript Start` text resource.

- `serial_project_type.json` — Serial
    - For serialized works with `Episodes`, `Characters`, and `Assets`. Seeds an `Episode Template` resource.

- `article_project_type.json` — Article
    - Short-form articles with `Drafts`, `References`, and `Assets`. Seeds an `Article Outline` resource.

Usage

You can point the CLI at one of these templates when creating a new project. Example (from `frontend` or any working directory):

```sh
node ./dist-cli/bin/getwrite-cli.cjs project create ./my/new-project \
  --spec ../getwrite-config/templates/project-types/novel_project_type.json \
  --name "My Project"
```

Notes

- Each template validates against the project-type schema; the `Workspace` folder is required by the schema.
- Edit or extend templates to add folder names or default resources as needed.
