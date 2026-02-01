---
description: Diagnose and fix a bug from an error message, log output, or bug description. Paste the error and let Claude handle the rest.
---

Diagnose and fix the following issue:

$ARGUMENTS

Follow this process:

1. **Reproduce**: Understand the error — read the stack trace, identify the file and line
2. **Root cause**: Trace back to the actual cause, not just the symptom
3. **Search for related issues**: Check if this pattern exists elsewhere in the codebase
4. **Fix**: Make the minimal change needed to fix the root cause
5. **Verify**: Ensure the fix doesn't break related functionality
6. **Test**: Run `npm run build` to verify no type errors were introduced

Do NOT refactor surrounding code. Do NOT add features. Just fix the bug.
