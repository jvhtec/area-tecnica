---
description: Enter plan mode to analyze a complex task before implementation. Use for multi-file changes, architecture decisions, or when something went sideways.
---

Switch to plan mode. Analyze the codebase thoroughly before proposing any changes.

**Task to plan**: $ARGUMENTS

Follow this process:

1. **Understand the scope**: Read all relevant files and understand the current implementation
2. **Identify dependencies**: Map which files, hooks, components, and database tables are involved
3. **Consider edge cases**: Think about error states, mobile vs desktop, timezone handling (Europe/Madrid), and existing patterns
4. **Draft the plan**: Write a numbered step-by-step implementation plan with specific file paths and changes
5. **Identify risks**: Note any breaking changes, migration needs, or Supabase RLS policy impacts
6. **Estimate complexity**: How many files change? Are there database migrations needed?

Do NOT make any code changes. Only produce the plan. Ask clarifying questions if the task is ambiguous.
