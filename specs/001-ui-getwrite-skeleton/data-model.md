# data-model.md — UI-focused data model (display-only)

This document enumerates the UI-facing entities used by the frontend for placeholder data and component props. This is not a persistence model; fields are shaped for rendering and interactions.

Entities

- Project (UI)
    - id: string
    - name: string
    - type: string
    - createdAt: string (ISO)
    - resourcesCount: number

- Resource (UI)
    - id: string
    - name: string
    - type: enum {text,image,audio,folder}
    - size: number
    - status: string | null
    - parentId: string | null
    - children?: Resource[] (for folder rendering)

- Revision (UI)
    - id: string
    - resourceId: string
    - name: string
    - createdAt: string
    - lastSavedAt: string
    - isCanonical: boolean

- Metadata (UI)
    - notes: string
    - statuses: string[] (project-scoped list)
    - characters: string[] (ids)
    - locations: string[] (ids)
    - items: string[] (ids)
    - pov: string | null
    - timeframe: { start?: string, end?: string }

Usage notes

- Components should accept these shapes as props and render placeholder values when fields are empty.
- Keep the model shallow for UI rendering; nested data (e.g., children) is only used by tree views and organizer lists.
