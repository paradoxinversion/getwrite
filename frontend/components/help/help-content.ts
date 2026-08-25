export type HelpTab =
  | "overview"
  | "projects"
  | "resources"
  | "metadata"
  | "editor"
  | "organizer"
  | "types"
  | "preferences";

export type HelpRichTextPart =
  | string
  | { kind: "strong" | "em" | "kbd"; text: string };

export interface HelpParagraphBlock {
  type: "paragraph";
  content: HelpRichTextPart[];
}

export interface HelpHeadingBlock {
  type: "heading";
  content: HelpRichTextPart[];
}

export interface HelpTipCardBlock {
  type: "tip-card";
  title?: string;
  items: HelpRichTextPart[][];
}

export type HelpContentBlock =
  | HelpParagraphBlock
  | HelpHeadingBlock
  | HelpTipCardBlock;

export interface HelpTabDefinition {
  id: HelpTab;
  label: string;
  blocks: HelpContentBlock[];
}

const strong = (text: string): HelpRichTextPart => ({ kind: "strong", text });
const em = (text: string): HelpRichTextPart => ({ kind: "em", text });
const kbd = (text: string): HelpRichTextPart => ({ kind: "kbd", text });

export const HELP_TABS: HelpTabDefinition[] = [
  {
    id: "overview",
    label: "Getting Started",
    blocks: [
      {
        type: "paragraph",
        content: [
          "GetWrite is a writing application for creative projects — novels, serial fiction, poetry, scripts, and more. Everything lives inside a ",
          strong("project"),
          ", which organises your content into folders and files called ",
          strong("resources"),
          ".",
        ],
      },
      {
        type: "tip-card",
        title: "Quick workflow",
        items: [
          [
            "Open GetWrite -> the ",
            strong("Start Page"),
            " lets you create, open, or manage projects.",
          ],
          [
            "Select a project to enter the ",
            strong("Create Interface"),
            " with sidebar, work area, and metadata panel.",
          ],
          ["Click any resource in the sidebar to open it in the work area."],
          [
            "Right-click a resource for copy, duplicate, delete, and export options.",
          ],
          [
            "Use the settings menu (gear icon) to access preferences and project type management.",
          ],
        ],
      },
      { type: "heading", content: ["Three-pane layout"] },
      {
        type: "paragraph",
        content: [
          "The interface is divided into three columns: a collapsible ",
          strong("Resource Tree"),
          " on the left, the central ",
          strong("Work Area"),
          ", and a collapsible ",
          strong("Metadata Panel"),
          " on the right. Drag the dividers to resize panes, or click the arrow buttons to collapse them.",
        ],
      },
      { type: "heading", content: ["Keyboard shortcuts"] },
      {
        type: "tip-card",
        items: [
          [kbd("Esc"), " - close open menus and modals."],
          [
            "Standard text-editor shortcuts (",
            kbd("Cmd/Ctrl + Z"),
            " undo, ",
            kbd("Cmd/Ctrl + Shift + Z"),
            " redo) work in the editor.",
          ],
        ],
      },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    blocks: [
      {
        type: "paragraph",
        content: [
          "A ",
          strong("project"),
          " is a self-contained writing workspace stored as a folder on disk. Each project has a top-level folder named after the project, plus any subfolders you or the project type template created.",
        ],
      },
      { type: "heading", content: ["Creating a project"] },
      {
        type: "paragraph",
        content: [
          "From the Start Page, click ",
          strong("Create New Project"),
          ". You will be asked to choose a ",
          strong("project type"),
          " (which determines the initial folder structure) and give the project a name.",
        ],
      },
      { type: "heading", content: ["Managing projects"] },
      {
        type: "tip-card",
        title: "Start page actions",
        items: [
          [strong("Open"), " - opens an existing project from disk."],
          [strong("Copy"), " - duplicates the project folder."],
          [strong("Rename"), " - renames the project display name."],
          [
            strong("Delete"),
            " - removes the project (",
            em("cannot be undone"),
            ").",
          ],
          [strong("Package"), " - exports the project as a portable zip file."],
        ],
      },
      { type: "heading", content: ["Metadata source folders"] },
      {
        type: "paragraph",
        content: [
          "Any folder can be marked as a ",
          strong("metadata source"),
          ". Documents inside it can then be linked to other documents from the Metadata Panel — which is how the built-in project types offer ",
          strong("Characters"),
          ", ",
          strong("Locations"),
          ", and ",
          strong("Items"),
          " in the novel and serial types, and folders like ",
          strong("Research"),
          " or ",
          strong("Fact Checking"),
          " in others. Nothing depends on the folder's name: you can mark a folder you created yourself, rename one, or remove the flag. No folder is protected, and none is pinned to a fixed position in the tree.",
        ],
      },
    ],
  },
  {
    id: "resources",
    label: "Resources & Files",
    blocks: [
      {
        type: "paragraph",
        content: [
          "A ",
          strong("resource"),
          " is any file or folder inside your project. Resources can be text documents, images, or audio files. Each resource has a stable identity independent of its folder path or display name.",
        ],
      },
      { type: "heading", content: ["Resource types"] },
      {
        type: "tip-card",
        items: [
          [strong("Text"), " - rich-text document editable in the editor."],
          [
            strong("Image"),
            " - displayed in the work area; resolution and Exif data shown in the metadata panel.",
          ],
          [
            strong("Audio"),
            " - play/pause/scrub widget; duration and type shown in metadata.",
          ],
          [
            strong("Folder"),
            " - groups other resources; selecting a folder opens its contents in the work area.",
          ],
        ],
      },
      { type: "heading", content: ["Revisions"] },
      {
        type: "paragraph",
        content: [
          "Every resource maintains a linear revision history. The most recent revision is the canonical (active) one. You can view previous revisions from the Metadata Panel. Editing a previous revision will prompt a warning; saving it promotes it to the newest revision. The canonical revision cannot be deleted.",
        ],
      },
      { type: "heading", content: ["Drag and drop reordering"] },
      {
        type: "paragraph",
        content: [
          "Resources and folders can be reordered inside the Resource Tree via drag and drop. Their order in the tree is reflected in the Organizer View.",
        ],
      },
    ],
  },
  {
    id: "metadata",
    label: "Metadata",
    blocks: [
      {
        type: "paragraph",
        content: [
          "Every resource can carry ",
          strong("metadata"),
          " — structured information ",
          em("about"),
          " a document that lives alongside it but never appears in the text itself. Think of it as the index card clipped to a manuscript: who the point-of-view character is, what stage the draft is at, when a scene takes place. GetWrite saves this in a small companion file next to each resource, so it travels with your project but stays out of your prose.",
        ],
      },
      {
        type: "paragraph",
        content: [
          "You do not have to use metadata at all — a project works fine with none. But filling it in is what powers ",
          strong("smart folders"),
          ", the ",
          strong("Timeline"),
          ", and the ",
          strong("Organizer"),
          " filters described below.",
        ],
      },
      { type: "heading", content: ["The Metadata Panel"] },
      {
        type: "paragraph",
        content: [
          "Metadata is edited in the ",
          strong("Metadata Panel"),
          " — the collapsible pane on the right side of the Create Interface. Select any resource and its fields appear, organised into collapsible groups. Values are ",
          strong("saved automatically"),
          " as you type or change them, exactly like the editor — there is no save button.",
        ],
      },
      {
        type: "tip-card",
        items: [
          [
            "If the panel is hidden, use the panel toggle on the right edge of the window to reveal it.",
          ],
          [
            "Each group is a collapsible section — click its header to fold fields you are not using out of the way.",
          ],
        ],
      },
      { type: "heading", content: ["Built-in fields"] },
      {
        type: "paragraph",
        content: [
          "Aside from ",
          strong("Status"),
          ", the built-in fields are optional — you switch each one on per project. ",
          strong("Synopsis"),
          ", ",
          strong("Notes"),
          ", ",
          strong("Point of View"),
          ", and the ",
          strong("Timeline"),
          " date fields each have a toggle (see ",
          em("Turning built-in fields on and off"),
          " below), so a new project starts with them off and shows them once you enable them. They live in two groups, ",
          strong("Document"),
          " and ",
          strong("Timeline"),
          ".",
        ],
      },
      {
        type: "tip-card",
        title: "Document",
        items: [
          [strong("Synopsis"), " - a short summary of the document."],
          [
            strong("Notes"),
            " - freeform notes for yourself; they stay separate from the document and are not included when you export it.",
          ],
          [
            strong("Status"),
            " - where the draft stands (for example Draft or Revised). The available choices come from the project type.",
          ],
          [
            strong("Point of View"),
            " - the character whose perspective the document follows. Link an existing resource, or simply type a name.",
          ],
        ],
      },
      {
        type: "tip-card",
        title: "Timeline",
        items: [
          [
            strong("Story Date"),
            " - this can be the start of a scene in a fiction project, the date of a real-world event in a non-fiction project, the start time of a recording for a podcast, or anything else you want it to be.",
          ],
          [
            strong("Duration (minutes)"),
            " - a length time associated with the resource.",
          ],
          [
            strong("Story End Date"),
            " - calculated automatically from the Story Date plus the Duration, or set by hand to override it.",
          ],
        ],
      },
      { type: "heading", content: ["Turning built-in fields on and off"] },
      {
        type: "paragraph",
        content: [
          "The optional built-in fields are controlled from the ",
          strong("Built-in features"),
          " section at the top of the Metadata Fields manager (settings menu → ",
          strong("Metadata"),
          "). Tick ",
          strong("Timeline"),
          ", ",
          strong("Point of View"),
          ", ",
          strong("Synopsis"),
          ", or ",
          strong("Notes"),
          " to add that field to the panel; untick it to hide it. Hiding a field ",
          em("keeps"),
          " every value you have already saved, so turning it back on restores them untouched.",
        ],
      },
      {
        type: "paragraph",
        content: [
          "The chronological ",
          strong("Timeline View"),
          " has its own switch in ",
          strong("User Preferences"),
          " under ",
          strong("Timeline view"),
          ". Because that view reads the Timeline date fields, the two are linked: enabling the view also enables the date fields, and disabling the date fields also turns the view off.",
        ],
      },
      { type: "heading", content: ["Field types"] },
      {
        type: "paragraph",
        content: [
          "When you create your own field you choose a ",
          strong("type"),
          ", which controls how its value is entered and stored:",
        ],
      },
      {
        type: "tip-card",
        items: [
          [strong("Text"), " - a line of free text."],
          [strong("Number"), " - a numeric value."],
          [strong("Date"), " - a calendar date and time."],
          [strong("Boolean"), " - a simple on / off toggle."],
          [strong("Select"), " - pick one value from a list you define."],
          [strong("Multi"), " - pick several values from a list you define."],
          [strong("Ref"), " - a link to another resource in your project."],
          [
            strong("Multi Ref"),
            " - links to several resources, optionally limited to a chosen folder and a maximum number.",
          ],
        ],
      },
      { type: "heading", content: ["Adding your own fields"] },
      {
        type: "paragraph",
        content: [
          "Beyond the built-ins you can define whatever fields your project needs — Theme, Setting, a word-count goal, a tension rating, anything you want to track. Click ",
          strong("+ Add field"),
          " at the bottom of the Metadata Panel, type a name, then pick a label, a type, and the group it belongs to.",
        ],
      },
      {
        type: "paragraph",
        content: [
          "As you type, GetWrite suggests fields that already exist and asks ",
          em("“Did you mean…?”"),
          " so you do not accidentally create two fields that mean the same thing. If a field with that name already exists, pressing Add simply jumps you to it.",
        ],
      },
      { type: "heading", content: ["Groups"] },
      {
        type: "paragraph",
        content: [
          "Fields are organised into ",
          strong("groups"),
          " — the collapsible sections in the panel. Every project starts with the Document and Story Timeline groups. When you create a field you choose which group it belongs to, and you can add more groups from the Metadata Fields manager to keep related fields together.",
        ],
      },
      { type: "heading", content: ["The Metadata Fields manager"] },
      {
        type: "paragraph",
        content: [
          "For larger changes, open the settings menu (gear icon) and choose ",
          strong("Metadata"),
          ". The Metadata Fields manager lets you reshape the whole schema:",
        ],
      },
      {
        type: "tip-card",
        items: [
          ["Add, reorder, and remove groups and fields."],
          [
            "Rename a field's display ",
            strong("label"),
            ", or rename its underlying ",
            strong("key"),
            " — renaming the key migrates existing values across the whole project.",
          ],
          [
            "Change a field's ",
            strong("type"),
            " — a preview shows how existing values will convert before you commit.",
          ],
          [
            "Edit the list of options for ",
            strong("Select"),
            " and ",
            strong("Multi"),
            " fields.",
          ],
          [
            "Set the folder scope and a maximum number of selections for ",
            strong("Multi Ref"),
            " fields.",
          ],
        ],
      },
      { type: "heading", content: ["Removing a field: Deprecate or Clear"] },
      {
        type: "paragraph",
        content: [
          "Only ",
          strong("Status"),
          " is permanent. Every other field — the ones you added as well as the built-in Synopsis, Notes, Point of View, and Timeline fields — can be renamed or removed. When you remove one, GetWrite asks how to treat the values already stored on your resources:",
        ],
      },
      {
        type: "tip-card",
        items: [
          [
            strong("Deprecate"),
            " - hides the field from the panel but keeps every stored value. It stays available in queries, flagged as deprecated, so nothing is lost.",
          ],
          [
            strong("Clear"),
            " - permanently deletes the field's values from every resource. This ",
            em("cannot be undone"),
            ".",
          ],
        ],
      },
      { type: "heading", content: ["What metadata unlocks"] },
      {
        type: "paragraph",
        content: [
          "Metadata is not just record-keeping — it drives several of GetWrite's most useful features:",
        ],
      },
      {
        type: "tip-card",
        items: [
          [
            strong("Smart folders"),
            " - every field becomes something you can search on. Save a query (for example ",
            em("Status is Draft"),
            ", or ",
            em("Point of View is a given character"),
            ") and it appears as a smart folder in the resource tree that gathers every matching resource.",
          ],
          [
            strong("Timeline View"),
            " - when enabled for the project, plots every resource that has a Story Date, colour-coded by point of view.",
          ],
          [
            strong("Organizer View"),
            " - filters cards by Status, Character, Location, and Word Count, and can show any metadata field as each card's body.",
          ],
        ],
      },
      { type: "heading", content: ["Tags"] },
      {
        type: "paragraph",
        content: [
          "At the bottom of the panel is a ",
          strong("Tags"),
          " section — a lightweight way to label a resource with keywords when a full field would be overkill. Tags are shared across the project and can be managed from the settings menu under ",
          strong("Manage Tags"),
          ".",
        ],
      },
      { type: "heading", content: ["Image and audio metadata"] },
      {
        type: "paragraph",
        content: [
          "Image and audio resources carry the same editable fields and tags as text documents, so you can describe them however your project needs. Above those fields they also show a ",
          strong("read-only"),
          " technical section — image dimensions and EXIF data, or audio format and duration — extracted automatically when the file is added.",
        ],
      },
    ],
  },
  {
    id: "editor",
    label: "Editor",
    blocks: [
      {
        type: "paragraph",
        content: [
          "When a text resource is selected, the Work Area renders a rich-text editor. Changes are ",
          strong("auto-saved continuously"),
          " - there is no manual save step. Auto-save overwrites the current revision without creating a new one.",
        ],
      },
      {
        type: "tip-card",
        title: "Editor features",
        items: [
          [
            "Inline formatting: bold, italic, underline, and more via the toolbar or keyboard shortcuts.",
          ],
          ["Full undo/redo history is kept per-session (cleared on reload)."],
          [
            "Word count, character count, and paragraph count are shown in the footer.",
          ],
          [
            "Switching away without saving a manually edited earlier revision prompts a discard/save dialog.",
          ],
        ],
      },
      { type: "heading", content: ["Diff view"] },
      {
        type: "paragraph",
        content: [
          "Switch to ",
          strong("Diff View"),
          " from the view switcher to compare two revisions of a resource side-by-side.",
        ],
      },
      { type: "heading", content: ["Folder text view"] },
      {
        type: "paragraph",
        content: [
          "Selecting a folder containing only text resources renders all documents sequentially with dividers. Each document saves independently.",
        ],
      },
      { type: "heading", content: ["Data view"] },
      {
        type: "paragraph",
        content: [
          "Switch to ",
          strong("Data View"),
          " from the view switcher to see project statistics — resource count and total word count — plus a flat list of all resources.",
        ],
      },
      { type: "heading", content: ["Timeline view"] },
      {
        type: "paragraph",
        content: [
          "Switch to ",
          strong("Timeline View"),
          " to see a visual timeline of resources that have a ",
          strong("Story Date"),
          " set in the Metadata Panel. Resources are colour-coded by POV. Clicking a timeline item selects that resource.",
        ],
      },
    ],
  },
  {
    id: "organizer",
    label: "Organizer View",
    blocks: [
      {
        type: "paragraph",
        content: [
          "The ",
          strong("Organizer View"),
          " presents the contents of a selected folder as cards arranged left-to-right, top-to-bottom, matching the Resource Tree order.",
        ],
      },
      {
        type: "tip-card",
        title: "Card content",
        items: [
          ["Text files show a trimmed preview of their content."],
          ["Image files show a thumbnail."],
          ["Audio files show an inline player."],
          [
            "Choose what each card shows beneath its title — nothing, a text excerpt, or the value of any metadata field — from ",
            strong("User Preferences"),
            " under ",
            strong("Organizer Card Body"),
            ". A button in the view header toggles the body on and off.",
          ],
        ],
      },
      { type: "heading", content: ["Filtering"] },
      {
        type: "paragraph",
        content: [
          "Filter cards by ",
          strong("Status"),
          ", ",
          strong("Character"),
          ", ",
          strong("Location"),
          ", or ",
          strong("Word Count"),
          " using the filter controls at the top of the Organizer View.",
        ],
      },
      {
        type: "paragraph",
        content: [
          "Mixed-content folders (for example, text and images together) switch to Organizer View automatically when selected.",
        ],
      },
    ],
  },
  {
    id: "types",
    label: "Project Types",
    blocks: [
      {
        type: "paragraph",
        content: [
          strong("Project Types"),
          " are templates that define the initial folder structure and editor settings created when a new project is started. Bundled types include Blank, Novel, Serial, Article, Poetry and Lyrics, and Game Writing.",
        ],
      },
      { type: "heading", content: ["Managing project types"] },
      {
        type: "paragraph",
        content: [
          "Open ",
          strong("Project Type Manager"),
          " from the settings menu (gear icon). From there you can create new types, edit existing ones, configure default folders and resources, and delete types you no longer need.",
        ],
      },
      {
        type: "tip-card",
        title: "What a project type defines",
        items: [
          ["A unique ID and display name."],
          [
            "A description shown when selecting a project type during creation.",
          ],
          [
            "Default top-level folders and their contents created automatically for new projects.",
          ],
          [
            "Default subfolders seeded under a parent folder when a project is first created.",
          ],
          [
            strong("Statuses"),
            " — custom status labels (e.g. Draft, Revised) that can be assigned to resources.",
          ],
          [
            strong("Word Count Goal"),
            " — an optional target word count for the project.",
          ],
          [
            strong("Editor Settings"),
            " — custom heading styles and body typography applied in the editor.",
          ],
        ],
      },
    ],
  },
  {
    id: "preferences",
    label: "Preferences",
    blocks: [
      {
        type: "paragraph",
        content: [
          "Open ",
          strong("User Preferences"),
          " from the settings menu (gear icon) to customise the look and feel of GetWrite.",
        ],
      },
      { type: "heading", content: ["Appearance options"] },
      {
        type: "tip-card",
        items: [
          [
            strong("Color mode"),
            " - Light, Dark, or follow the system default. The quick toggle in the settings menu flips between light and dark immediately.",
          ],
          [strong("Density"), " - Comfortable or Compact layout spacing."],
          [strong("Reduced motion"), " - Disables non-essential animations."],
        ],
      },
      { type: "heading", content: ["Persistence"] },
      {
        type: "paragraph",
        content: [
          "Preferences are stored locally on your device and, when a project is open, also saved to the project's own configuration file so the same settings apply on every device you use to open that project.",
        ],
      },
    ],
  },
];
