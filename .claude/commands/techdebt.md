---
description: Scan the codebase for technical debt, duplicated code, and cleanup opportunities. Run at the end of every session.
disable-model-invocation: true
---

Scan the codebase for technical debt. Focus on recently changed files and the areas around them.

Look for:

1. **Duplicated code**: Functions or components that do nearly the same thing. Suggest consolidation.
2. **Dead code**: Unused imports, unreachable branches, commented-out blocks, exported functions with zero consumers.
3. **Inconsistent patterns**: Places where older code doesn't follow current conventions (e.g., direct Supabase calls instead of React Query hooks, inline styles instead of Tailwind).
4. **Type safety gaps**: Any `as any` casts, missing return types on exported functions, or untyped API responses.
5. **TODO/FIXME/HACK comments**: List them with file paths and line numbers.
6. **Large files**: Components over 300 lines that should be split.
7. **Missing error handling**: API calls without proper error handling or user feedback.

Output a prioritized list with file paths and specific line numbers. Group by severity: Critical, High, Medium, Low.

Do NOT fix anything. Just report.
