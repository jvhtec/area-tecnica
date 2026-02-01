---
name: techdebt-scan
description: Comprehensive technical debt scanner. Finds duplicated code, dead code, inconsistent patterns, and cleanup opportunities.
disable-model-invocation: true
context: fork
agent: Explore
---

Scan the codebase for technical debt. Focus on the most impactful issues.

## What to Look For

1. **Duplicated logic**: Components or functions that do nearly the same thing
2. **Dead code**: Unused exports, unreachable branches, orphaned files
3. **Pattern inconsistencies**: Old code not following current conventions
4. **Large files**: Components over 300 lines that should be split
5. **TODO/FIXME/HACK**: Collect all with file:line references
6. **Type safety**: `as any` casts, missing types on public APIs
7. **Missing error handling**: Unhandled promise rejections, missing catch blocks

## Output Format

Prioritized list grouped by severity:
- **Critical**: Bugs waiting to happen, security issues
- **High**: Significant duplication, major pattern violations
- **Medium**: Code quality issues, missing types
- **Low**: Style inconsistencies, minor cleanup

Include specific file paths and line numbers for each item.
