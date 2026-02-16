# GetWrite

## What We're Building

GetWrite is a web-based writing application for creative writing projects (ie, novels, serial fiction, poems, scripts, etc). GetWrite organizes projects in folders. Each project contains subfolders for organizing project resources. Project resources represent files, such as text files (plain text, rich text, markdown, docx if possible), images, or audio files. All files are stored within the project. Resource identity is independent of folder path.

Project resources can have associated revisions. Revisions must be the same file type associated with the resource. Revisions can be edited and deleted. Revisions are linear. The name shown for any resource remains static in the UI, unless changed by the user. The file associated with the resource is the latest revision by default. Users can also select which revision they want to be the canonical revision when the resource is selected in the UI. If a user selects and edits a previous revision, a warning should be shown. When the user explictly saves that revision, it should become the newest revision. The current/canonical revision cannot be deleted, but other revisions can. When a user navigates away without saving an edited revision, they should be prompted to save or discard it. Only one active revision can be set at one time. Max revisions per file will be defined in a configuration file. When additional revisions are created, the user should be prompted to select (a) revisions(s) to delete. If user declines to delete revisions, creation of new revision is aborted.

Revision Invariants:

- A resource must always have at least one revision.
- Exactly one revision is canonical at all times.
- Canonical revision must always exist.
- A revision must belong to exactly one resource.
- Deleting a revision cannot leave the resource without a revision.

The following folders are Special Resource folders:

- Characters: This folder contain text resources that are associated with characters/people that are referenced within the project
- Locations: This folder contains text resources that are associated with places that are referenced within the project
- Items: This folder contains text resources that are associated with items/objects referenced within the project
- Front matter: This folder contains front matter text files
- Back Matter: This folder contains back matter text files

Special Resource folders must be one level below the top and are not mandatory. They can be deleted or renamed. If Special Resource files or folders are deleted, all associations should be immediately removed. Associations are based on internal resource identity, not display name.

Resources/folders may have the following associated metadata:

- All resources/folders:
    - Size: The file size of the selected resource, or total combined file sizes of all files within the selected folder
    - Notes: Multiline text associated with the resource/folder
    - Status: A set of options that can be set by the user, defaulting to 'Draft', and 'Complete'. If all options are removed, 'No Statuses Available' should be shown in metadata displays, and the related Status metadata of all resources should be set null. Statuses are project-scoped and persisted in project config. They can be reordered.
- All resources except folders:
    - Revisions: A list of revisions by name, date created, and last saved. These entries are linked to specific revision files.
- All text files:
    - Characters: Characters (selected from the Characters special resource folder) associated with the text, generally implying the character appears in the text
    - Locations: Locations (selected from the Locations special resource folder) associated with the text, generally implying the location appears in the text
    - Items: Items (selected from the Items special resource folder) associated with the text, generally implying the object appears in the text
    - Text Metadata: Data about the text, such as word count, character count, paragraph count, sentence count, speaking time, etc.
    - POV: The point of view for the text resource. This can be an arbitrary string or selected from Characters special resource folder. If the string matches a resource in the Characters special resource folder, it should be associated with that resource. If a Character special resource is selected and that resource is deleted, the field should be preserved as a string.
    - Timeframe: A beginning and end timestamp (simple, ie: YYYY/MM/DD, HH:MM) and the calculated length of time between these timestamps (if both timestamps are present). End must be after beginning.
- All image files:
    - Image resolution
    - Exif data
- All audio files:
    - Audio's length
    - Type (wav, mp3, etc)
    - Additional metadata, such as creator, description, etc (if it exists)

When users open GetWrite, they will be presented with a start page, from which they can create a new project, open an existing one, or manage existing projects (allowing them to copy, delete, rename, or package a project into a zip file for portability).

Creating a new project will prompt the users to select the type of project they want to create (ie, novel, serial fiction, etc) and set up a basic file structure, with a top-level folder whose name is the project name. The default subfolders of new projects, with the exception of a 'Workspace' folder, will be determined by declarative resources, thereby allowing users to modify existing project types or create new ones. The Workspace folder is where users will add the content they intend to release. The Workspace folder cannot be renamed, deleted, or moved out of the first level. Its placement in the Resource Tree should always be first, after the project root.

After a user has created a new project or selected an existing one, they'll be taken to the Create Interface. The Create interface has 3 primary elements:

- A sidebar on the left, which shows the project's Resource Tree.
    - When a resource is selected, it is opened in the work area.
    - When a resource is right-clicked, users can copy, duplicate, delete, or export it.
    - When a folder is selected, its contents are opened in the work area.
    - When a folder is right-clicked, users can copy, duplicate, delete, or export it.
    - Users can reorder files via drag and drop.

- A Work Area in the center. The work area has X views:
    - Edit View: Where users will view and edit the contents of their project resources. Edit view should keep a persistent history allowing users to undo/redo changes while in-session. Undo/redo history is not kept between sessions. Undo history should be tied to revisions. Auto-save does not create new revisions. Autosave is debounced.
        - If the user has selected a text resource, the work area renders a text processor.
            - Text resources are automatically saved when edited by users, overwriting the current revision, and should persist across refreshes.
            - The footer of this view should show data about the text, such as word count, character count, and paragraph count.
        - If the user has selected an image resource, the work area renders the image.
        - If the user has selected an audio resource, the work area renders an audio widget which allows them to play, pause, stop, or scrub through the audio resource.
        - If the user has selected a folder:
            - If all files in the folder are text files, they are shown sequentially with a divider between each file. When a user edits text in this view, only the file the text belongs to will be updated and saved.
            - If all files in the folder are images, the images will be shown sequentially.
            - If all files in the folder are audio, audio players will be rendered sequentially.
            - Selecting folders with mixed content (eg, text, audio, image) should automatically switch the view to the Organizer View.
    - Organizer View: Presents project resources as cards.
        - If the user has selected a folder, cards representing each file/subfolder will be shown from left to right, top to bottom, and their order will match the order in which they are shown in the Resource Tree. The card names will be the names of their respective files (without extensions) or subfolders. Cards will have a button to open their respective file/folder. Users cannot reorder cards in the Organizer view. Users can filter cards by Status, Character, Location, and Word Count.
            - If the card represents a text file, its default body will be the text of the file, trimmed to fit the card.
            - If the card represents an image file, its default body will be the image, resized to fit the card.
            - If the card represents an audio file, its default body will be an audio player.
        - This view will have a button that allows users to switch the body of the cards between the default for their type or notes associated with the resource. If no notes exist, the default body for the card will be used.
    - Data View: Shows data about the project with the following sections:
        - Overall Stats:
            - Word Count: The total word count of all text in the workspace folder (including subfolders).
            - Paragraph Count: The paragraph count of all text in the workspace folder (including subfolders).
            - Sentence Count: The total sentence count of all text in the workspace folder (including subfolders).
            - Reading time: The estimated reading time of all text in the workspace folder (including subfolders).
            - Workspace Resources: The total amount of resource files located in the Workspace (including files in subfolders)
        - Resources:
            - Characters: A foldable list with the Character resource name and total appearances in user-created resource metadata as the heading, with subsequent rows listing each resource in which they appear. Clicking a non-header row should open the related resource.
            - Locations: A foldable list with the Location resource name and total appearances in user-created resource metadata as the heading, with subsequent rows listing each resource in which they appear. Clicking a non-header row should open the related resource.
            - Items: A foldable list with the Item resource name and total appearances in user-created resource metadata as the heading, with subsequent rows listing each resource in which they appear. Clicking a non-header row should open the related resource.
    - Dif View: When dif view is enabled, two read-only panes should be rendered. When a user clicks a text resource, the left pane should display the current revision. The right pane should show a list of revisions (or display 'No Revisions Available). When a user selects a revision in the right pane, it should show the dif between the left pane and right pane data.
        - Only text files can be selected for dif view.
        - Difs should be word-based
    - Timeline View: Shows all resource files with beginning and end timestamp metadata, in chronological order (sorted by beginning timestamp). If only beginning timestamp exists, sort by that. If two resource's timestamps overlap, or start at the same time, the one with the earlier start time should have priority. If overlapping timestamps have the same start time, the one with the earlier end time should have priority. If no timeframe metadata exists, associated resources should be shown in a separate section at the bottom. If start and end are identical, order follows Resource Tree order.

- A sidebar on the right, which shows metadata about the selected folder or resource. When no resource is selected, the metadata sidebar is hidden. Metadata associations are evaluated against current state only (not historical revisions).
    - The metadata sidebar has the following sections:
        - Notes, a multi-line text input for users to write notes about the resource
        - Status, a selector that allows users to choose what state their project is in. These options can be set by the user, but default to 'Draft' and 'Complete'.
        - If the selected resource is text, the following sections are included:
            - Locations: A list of Locations (pulled from the Locations special resource folder). Users can select multiple locations. Users can click a button to select the resource.
            - Characters: A list of Characters (pulled from the Characters special resource folder). Users can select multiple characters. Users can click a button to select the resource.
            - Items: A list of Items (pulled from the Items special resource folder). Users can select multiple Items. Users can click a button to select the resource.
            - POV: An element allowing the user to type in a POV. Should allow autocomplete from the Characters special resource folder.
            - Timeframe: An element allowing the user to set the beginning and ending timestamps.
        - Data, which shows meta-information about the resource:
            - It always shows the file size of the associated resource
            - If the resource is text:
                - Shows basic text data such as word count, character count, paragraph count, etc.
            - If the resource is audio:
                - Shows the audio's length, type (wav, mp3, etc), and additional metadata
            - If the resource is an image:
                - Shows the images resolution and other surfacable data

Users should be able search:

- Text across all resources in the project
- Text within specific resource folders
- Text across resource revisions

When searching users should be able to filter by:

- Status
- Characters
- Items
- Locations
- Word Count
    - Greater than
    - Less than
    - In Range

When clicking a search result:

- If the search is not across revisions:
    - Open the resource and highlight the first match
- If it is across revisions:
    - Open the dif view, with the proper revision selected in the right pane. The left pane should show the current canonical revision. Most recent matching revision is selected.

GetWrite will allow users to compile multiple text files into single documents. For instance, if a user has a project representing a novel, whose Workspace folder contains subfolders for each chapter, containing multiple scenes for those chapters, the compile command will return a single document in a supported file format (ie, most text file types or PDF). Before compilation, users will be be able to select which project subfolders and files will be included. Compiling should respect folder and resource order, except in the case of Special Resource folders. By default, compile includes all resources in the Workspace folder and excludes Special Resource folders. Front matter (if it exists) should be the at the top of the compile list. Back matter (if it exists) should be after the Workspace folder. Characters, Locations, and Items should be listed after Back matter, as they are formatted within their files, in the order in which their folders/files are organized in the Resource Tree. Users cannot override other file or resource order during compile (this should be done in the Resource Tree). Image resources can be included in compile. No metadata is included in compiled results. Audio files cannot be included in compilation at this time. Compile is export only, and does not affect revisions. If a parent folder is selected, all children should be selected, and can be deselected individually. If all children are deselected, the parent folder should also be deselected.

V1 will support a single user and is local-first, with all resources/folders stored within the user's filesystem. Projects will exists in a single root directory. Revisions will be saved as seperate files. Metadata for each resource is stored as a file alongside the related resource. Moving a resource changes its directory path on disk. Identity is stored in metadata. If a resource folder is deleted, all descendents are deleted as well. Deletion is permanent and should include a warning whenever deleting a resource.

Future versions will introduce multiple user functionality.

System Invariants

- Workspace folder always exists and is first under root.
- Exactly one canonical revision exists per resource.
- A resource must always contain at least one revision.
- Resource identity is immutable and independent of folder path.
- Compile does not mutate project state.
