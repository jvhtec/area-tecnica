---
description: Verify that recent changes work correctly. Diff against main, run the build, and prove correctness.
disable-model-invocation: true
---

Verify the current changes are correct and complete.

1. **Diff review**: Run `git diff main...HEAD` and review every change
2. **Build check**: Run `npm run build` — it must pass with zero errors
3. **Behavioral check**: For each changed file, verify the logic is correct by reading the surrounding code
4. **Integration check**: Are all the pieces connected? Do imports resolve? Are React Query keys consistent?
5. **Regression check**: Could any change break existing functionality? Check callers of modified functions.

Report: PASS or FAIL with specific issues found.

Do NOT make changes. Only verify and report.
