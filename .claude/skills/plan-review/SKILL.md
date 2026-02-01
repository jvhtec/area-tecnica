---
name: plan-review
description: Two-phase planning workflow. First creates a detailed implementation plan, then reviews it as a staff engineer before proceeding with implementation.
disable-model-invocation: true
context: fork
agent: Plan
---

You are planning a complex implementation task. Do NOT write any code.

**Task**: $ARGUMENTS

## Phase 1: Create the Plan

1. Explore the relevant codebase areas using Glob, Grep, and Read
2. Understand the current architecture and patterns in use
3. Create a detailed step-by-step implementation plan that includes:
   - Specific file paths that need to change
   - What each change involves
   - Order of operations (what depends on what)
   - Database migration needs (if any)
   - Any new files that need to be created

## Phase 2: Self-Review

After creating the plan, review it critically:

- Are any steps missing?
- Could any change break existing functionality?
- Does the plan follow the codebase's established patterns?
- Are there simpler alternatives?
- What are the risks?

## Output

Present the final plan with a confidence rating (High/Medium/Low) and any open questions that need human input before proceeding.
