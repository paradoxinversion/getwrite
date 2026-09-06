# Metadata

Metadata is the extra information attached to each resource in your project — notes, status, point-of-view, dates, and any custom fields you want to track. You edit it through the **Metadata sidebar** on the right of the Work Area when a resource is selected.

> For the on-disk field reference (every field, its type, and where it is stored), see the developer doc at [docs/features/data/metadata.md](../features/data/metadata.md).

## System vs. user metadata

GetWrite keeps two kinds of metadata:

- **System metadata** is created and maintained automatically — things like the resource's ID, creation date, file location, and word count. You don't edit these directly; the app keeps them correct for you.
- **User metadata** is the information you add — synopsis, notes, status, point-of-view, story dates, and any custom fields. This is what the Metadata sidebar is for.

If you ever open a resource's metadata file directly, this symbol legend tells you what is safe to touch:

- 🤖 Managed by the system — don't edit by hand; changes may break the file.
- ✏️ Safe to edit directly in a text editor or through the sidebar.

Everything else should be changed through the app UI so the app can keep related data consistent.

## What you can set on a resource

Every project includes a **Status** field, plus a set of optional built-in fields you can switch on as needed. All are edited from the Metadata sidebar:

- ✏️ **Status** — where the resource is in your workflow (e.g. Draft, In Review, Published). Always available. The options come from your project's status list — see [Project Configuration](project-configuration.md) to customize them.
- ✏️ **Synopsis** — a short summary of the resource. _(optional)_
- ✏️ **Notes** — free-text notes for the resource. _(optional)_
- ✏️ **Point of View** — the POV character, set by linking to another resource (such as a character document). The Timeline view uses this to color-code scenes. _(optional)_
- ✏️ **Story Date**, **Duration (minutes)**, and **Story End Date** — the in-story timing of the resource, grouped under the **Timeline** section of the sidebar. Adding a Story Date places the resource on the [Timeline](views/timeline.md). _(optional)_

The optional fields are off by default, so a new project shows only Status until you turn on the ones you want. Toggle them per project from the **Built-in features** section at the top of the Metadata Fields manager (settings menu → **Project Settings** → **Metadata** tab). Hiding a field keeps every value you have already saved, so turning it back on restores them untouched. Apart from Status, the built-in fields can also be renamed or removed just like custom fields.

Beyond these, you can add your own **custom fields** of any type — text, number, date, yes/no, single- or multiple-choice, or links to other resources — to track whatever your project needs (characters, locations, props, and the like). Fields that link to other resources draw their choices from metadata-provider folders (see below).

Image and audio resources carry the same editable fields and tags as text documents, with a read-only technical section (image dimensions and EXIF data, or audio format and duration) shown above them.

## Tags

Tags are project-scoped labels you can assign to any resource. Assign or remove them from the **Tags** section of the Metadata sidebar; create, rename, and delete tags from the project settings UI. Because tag assignments are tracked across the whole project, manage tags through the app rather than editing files by hand.

## Metadata providers

Folders can act as **metadata providers** — collections like Characters, Locations, or Items — that other documents can link to. Instead of retyping "Elena" on every scene she appears in, you point those scenes at the Elena document in your Characters folder.

Over time this builds a connected web of the people, places, and things in your work. It's a powerful way to keep a sprawling cast or a detailed setting straight, and to see at a glance everywhere a given entity shows up — and, from that entity's own view, to compile everywhere it appears into a single document (see [Compiling Projects](compiling.md)).

## Project-level preferences

Some metadata applies to the whole project rather than a single resource — for example your preferred color mode (light/dark) and your workflow status list. These live in the project's configuration; see [Project Configuration](project-configuration.md) for how to set them.
