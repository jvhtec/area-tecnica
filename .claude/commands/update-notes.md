---
description: Update the session notes after completing a task or PR. Captures decisions, patterns discovered, and lessons learned.
disable-model-invocation: true
---

Update the project notes in `.claude/notes/` to capture what was learned in this session.

Create or update a note file named after today's date and task: `.claude/notes/YYYY-MM-DD-<short-description>.md`

Include:

1. **Task summary**: What was done in 1-2 sentences
2. **Files changed**: List the key files modified
3. **Decisions made**: Why specific approaches were chosen over alternatives
4. **Patterns discovered**: Any codebase patterns or conventions that were clarified
5. **Gotchas**: Anything surprising or tricky that future sessions should know about
6. **Follow-up items**: Things that were noticed but not addressed

Also check if any of these discoveries should be added to CLAUDE.md. If so, update CLAUDE.md with the new guidance.
