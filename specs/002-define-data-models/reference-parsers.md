# Reference Parser Proposals

This document lists candidate reference parsing strategies for GetWrite backlinks and cross-resource references. For each proposal I include the parse output shape and brief examples. Pick one or more you'd like implemented and I will add a concrete parser, tests, and wiring.

1. UUID-only (current)
    - Description: Detect explicit UUIDs in text. Very robust but low ergonomics for authors.
    - Match: any RFC-4122 v4 UUID
    - Example input: "see 123e4567-e89b-12d3-a456-426614174000"
    - Output shape: { type: 'uuid', id: '123e...' }

2. Wikilink (title or id)
    - Description: Use `[[target]]` where `target` can be a resource id or a human title.
    - Match: `\[\[([^\]]+)\]\]` with heuristic: if content matches UUID, resolve as id, otherwise treat as title to resolve via project index.
    - Example input: "See [[My Chapter]] or [[123e...]]"
    - Output shape: { type: 'wikilink', raw: 'My Chapter', id?: '123e...' }

3. Markdown link with resource scheme
    - Description: Use standard Markdown link syntax but with a `resource:` scheme linking to ids or slugs: `[text](resource:<id|slug>)`.
    - Match: `/\[([^\]]+)\]\(resource:([^\)]+)\)/`
    - Example: `[see](resource:123e...)`, `[intro](resource:my-intro-slug)`
    - Output shape: { type: 'markdown', text: 'see', target: '123e...' }

4. Shortlink prefix (human-friendly)
    - Description: Prefix-based shortlinks `r:<slug>` or `r#<id>` embedded in text.
    - Match: `/\br:([A-Za-z0-9\-_]+)\b/` for slugs and `/\br#([0-9a-f-]{36})\b/` for UUIDs.
    - Output shape: { type: 'short', form: 'slug'|'id', value: '...' }

5. Hashtag-style resource references
    - Description: Use `#ResourceTitle` to reference resources discovered by title matching or slug.
    - Match: `/#[A-Za-z0-9-_]+/`
    - Output: { type: 'hashtag', label: 'ResourceTitle' }

Resolution behavior (notes)

- For any parser that yields a non-UUID token (title/slug/label), we need a resolver that maps the token to a resource id. Resolution strategies:
    - Exact slug match
    - Case-insensitive title match
    - Fuzzy/partial match (optional)

Acceptance criteria for chosen strategy:

- Parser returns a normalized array of parsed references per resource with types and original span positions (optional).
- A resolver function `resolveReference(projectRoot, parsedRef): Promise<resourceId | null>` attempts to map non-id tokens to resource ids.

Pick one or more proposals and I'll implement the corresponding parser(s) and resolver, add unit tests, and wire them into `computeBacklinks` so backlinks reflect resolved references as well as raw UUID mentions.
