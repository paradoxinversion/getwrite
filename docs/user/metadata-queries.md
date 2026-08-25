# Metadata Queries & Smart Folders

Your documents carry a lot of structured information — point-of-view, status, story dates, tags, word counts, custom fields, and more (see [Metadata](metadata.md)). **Metadata queries** let you ask questions of all that information at once: _show me every scene from Mara's POV, tagged `flashback`, under 500 words._ Save a query and it becomes a **smart folder** — a living collection that always reflects whatever currently matches, no manual upkeep required.

For a long project, this turns a pile of documents into something you can interrogate: find what's missing, gather what belongs together, and keep an eye on the shape of the whole.

## Metadata queries vs. search

GetWrite has two ways to find things, and they complement each other:

- **[Search](search.md)** (`Cmd/Ctrl+K`) is for quickly jumping to a document when you know roughly what it's called.
- **Metadata queries** are for filtering your project by what documents _are_ — their status, POV, dates, tags, length, and relationships — and for saving those filters to reuse.

## Building a query

Smart folders live in the **Smart folders** section of the sidebar. Click the **+** there to start a new query and open the query builder.

You build a query from **filter chips**. Each chip is one condition and reads like a sentence:

> **Status** **is** **Draft**

To add a condition, add a chip and choose:

1. **A field** — what to filter on (see [Queryable fields](#queryable-fields) below).
2. **An operator** — how to compare it (the choices adapt to the field; see [Operators](#operators-by-field-type)).
3. **A value** — what to compare against (a text box, number, date, or a picker of the field's allowed values).

### Combining conditions with AND / OR

You can group conditions and choose whether each group requires **all** of its conditions (AND) or **any** of them (OR). Two levels of grouping are supported — enough to express filters like:

> POV **is** Mara **AND** ( Status **is** Draft **OR** Status **is** In Review )

For logic more intricate than two levels allow, switch to **advanced mode** (below).

## Queryable fields

You can filter on two kinds of fields.

**Your metadata fields** — everything defined for the project, including the built-ins (Synopsis, Notes, Status, Point of View, Story Date, Duration, Story End Date) and any [custom fields](metadata.md) you've added.

**Built-in document attributes** — properties every resource has, even though they aren't metadata fields you set by hand:

| Field               | What it filters on                                       |
| ------------------- | -------------------------------------------------------- |
| **Type**            | Whether the resource is text, image, audio, or a folder. |
| **Folder**          | Which folder the resource lives in.                      |
| **Word Count**      | Length of a text document, in words.                     |
| **Character Count** | Length of a text document, in characters.                |
| **Created At**      | When the resource was created.                           |
| **Updated At**      | When the resource was last changed.                      |
| **Statuses**        | The workflow status values applied to the resource.      |
| **Tags**            | The [tags](metadata.md#tags) assigned to the resource.   |
| **Linked From**     | Other resources that link _to_ this one.                 |
| **Links To**        | Resources this one links _to_.                           |

`Linked From` and `Links To` let you walk the web of connections in your project — for example, _every scene that references the Antagonist's character sheet_.

## Operators by field type

The operators offered depend on the field's type, so you can never build a nonsensical condition. Every field also supports **is empty** and **has any value**, which is the key to quality-control queries like _scenes without a POV_ or _resources missing a status_.

| Field type                                                      | Operators                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Text** (e.g. Notes, Synopsis)                                 | is · is not · contains · does not contain · starts with · matches regex · is empty · has any value                          |
| **Number** (e.g. Word Count)                                    | equals · does not equal · is less than · is at most · is greater than · is at least · is between · is empty · has any value |
| **Date** (e.g. Story Date, Created At)                          | is on · is before · is after · is between · in the last · is empty · has any value                                          |
| **Yes/No**                                                      | is true · is false · is empty · has any value                                                                               |
| **Single choice / single reference** (e.g. Status, POV)         | is · is not · is any of · is none of · is empty · has any value                                                             |
| **Multiple choice / multiple references** (e.g. Tags, Statuses) | includes · does not include · includes all of · includes any of · includes none of · is empty · has any value               |

## Saving as a smart folder

Once a query does what you want, give it a name and save it. It then appears as a **smart folder** in the sidebar, marked with a search icon.

Click a smart folder any time to run it and see what currently matches. Because it re-runs against your project's live data, the results stay current as you write and edit — a smart folder called _Needs a POV_ empties itself as you fill in the missing fields.

Hover a smart folder to **edit** it (refine the query) or **delete** it. Editing opens the query builder pre-filled with the saved conditions.

## Advanced mode

When a query's logic goes beyond the two levels of grouping the chip builder supports, GetWrite switches it into **advanced mode**: chip editing is disabled and you edit the query directly as JSON (its underlying structure) in a text box. A **Back to chip view** button returns you to the chip builder once the query is simple enough to represent that way again. The chip builder and advanced mode are two views of the same query.

## Examples

A few questions you can answer with a saved smart folder:

- **Find a specific set of scenes** — _Tags includes `flashback`_ AND _POV is Mara_ AND _Word Count is less than 500_.
- **Story-time slice** — _Story Date is between_ two in-story dates, regardless of where those scenes sit in your document order. Pairs naturally with the [Timeline view](views/timeline.md).
- **Quality control** — _Status is empty_ to catch documents you haven't triaged, or _POV is empty_ to find scenes missing a viewpoint.
- **Staleness** — _Updated At is before_ a given date to surface chapters you haven't touched in a while.
- **Co-occurrence** — a custom multi-value field (say, Characters) that _includes all of_ Alice and Bob, to find every scene they share.
