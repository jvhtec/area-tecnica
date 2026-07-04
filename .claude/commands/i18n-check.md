---
description: Scan the current diff (or a given path) for hardcoded English UI text — this app's user-facing strings must be Spanish, per CLAUDE.md's Learned Rules, and it's a live, recurring mistake (grep the codebase and you'll find dozens of existing instances).
disable-model-invocation: true
---

Check for hardcoded English strings that will render in the UI: $ARGUMENTS (a path/component to focus on, or blank to check the current diff)

## Scope

Default to the current change set: `git diff --staged` if anything is staged, else `git diff origin/main...HEAD` (or `git diff` for uncommitted work). If a path is given instead, scan that file/directory directly — useful for auditing an existing area, not just new changes.

## What counts as user-facing (must be Spanish)

- JSX text nodes and children of any element (`<Button>Save</Button>`, headings, paragraphs)
- Props that render as visible or assistive text: `label`, `placeholder`, `title`, `aria-label`, `alt`, `description`, `helperText`, table column headers
- `toast({ title, description })` calls (`useToast`/`sonner`)
- **Zod validation messages** — `z.string().min(1, "This field is required")` renders in the form UI, it's easy to forget this is user-facing because it looks like code
- Dialog/Sheet/AlertDialog/Tooltip/DropdownMenu content
- Empty-state and loading-state copy (`"Loading..."`, `"No results found"`)

## What to skip (not user-facing, English is fine)

- `console.log`/`console.error`/code comments
- Variable, function, type, and prop names
- Database column/table names, enum values, API field names (Flex, Google Maps, etc.)
- Test file `describe`/`it`/`test` descriptions
- Error `code` strings meant for programmatic matching (not the `message` shown to the user)
- Generic shadcn/ui primitives in `src/components/ui/` — those are base library components; check whether the specific instance is a customized-for-this-app string vs a framework default before flagging

## Process

1. Get the diff/path scope above.
2. Look for added or existing lines matching common English UI copy — start with a quick grep as a hint, not the whole check: `\b(Save|Cancel|Submit|Delete|Edit|Create|Update|Loading|Confirm|Continue|Back|Next|Search|Filter|Add|Remove|Close|Open|Are you sure|Success|Failed?|Warning)\b` inside JSX/string-literal contexts — but use judgment beyond the list; plenty of English UI prose won't match these exact words.
3. For each candidate, confirm it's actually user-facing per the criteria above (not a false positive from the skip list).
4. Report `file:line`, the English string, and a suggested Spanish translation — match the register/terminology already used nearby in the same file or feature area if there's a precedent (e.g. if sibling buttons already say "Guardar"/"Cancelar", stay consistent with those, don't invent a different phrasing).

## Output

Report only by default — list every finding with `file:line`, the string, and the suggested translation. Only apply the fixes directly if explicitly asked to, since translation phrasing benefits from a human sanity-check before it ships.
