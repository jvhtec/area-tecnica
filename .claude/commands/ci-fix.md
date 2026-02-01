---
description: Fix failing CI/build. Run the build, read the errors, fix them all.
disable-model-invocation: true
---

The CI/build is failing. Fix it.

1. Run `npm run build` and capture ALL errors
2. Categorize the errors (type errors, import errors, missing modules, etc.)
3. Fix each error systematically — start with the ones that cascade (missing exports, broken imports)
4. After fixing, run `npm run build` again to verify
5. If there are still errors, repeat until the build is clean
6. Run `npm run lint` to check for remaining lint issues

Do NOT skip errors or add `@ts-ignore`. Fix the root cause.
