# Technical Debt Report

## Executive Summary
The codebase contains significant technical debt that hinders maintainability and scalability. The most critical issues are **type safety violations** (over 1300 usages of `any`), **massive component files** (some >2000 lines), and **code duplication**.

## 1. Type Safety Violations
*   **`any` usages:** 974 instances.
*   **`as any` assertions:** 395 instances.
*   **`@ts-ignore`:** 5 instances.
*   **Impact:** Severe risk of runtime errors and broken autocomplete.
*   **Action:** Enable `no-explicit-any` in ESLint and progressively type these variables.

## 2. Component Complexity (Monoliths)
Several files are too large to maintain effectively:
1.  `src/pages/FestivalManagement.tsx` (2178 lines)
2.  `src/pages/Wallboard.tsx` (2136 lines)
3.  `src/components/dashboard/JobCardNew.tsx` (1602 lines)
4.  `src/components/jobs/JobDetailsDialog.tsx` (1574 lines)
5.  `src/components/matrix/OptimizedAssignmentMatrix.tsx` (1573 lines)

*   **Action:** Break these into smaller sub-components (e.g., `FestivalHeader`, `FestivalGrid`, `WallboardCrewList`).

## 3. Code Duplication
*   **Critical:** `JobCardNew.tsx` exists in both `src/components/dashboard/` (1602 lines) and `src/components/jobs/cards/` (1174 lines).
*   **Impact:** Fixes applied to one version are not reflected in the other.
*   **Action:** Merge into a single `src/components/cards/JobCard.tsx`.

## 4. Styling Inconsistencies
*   **Inline Styles:** Widespread use of `style={{...}}` for layout, bypassing Tailwind.
*   **Hardcoded Colors:** Hex codes (e.g., `#7E69AB`) are hardcoded in components instead of using CSS variables or Tailwind config.
*   **Impact:** Inconsistent theming (Dark Mode issues) and difficulty in applying global design changes.

## 5. TODOs and FIXMEs
*   **Count:** ~40 `TODO` comments found.
*   **Action:** Review and convert valid TODOs into Jira/Linear tickets or fix immediately.

## Prioritized Fix Plan
1.  **Immediate:** Deduplicate `JobCardNew.tsx`.
2.  **High:** Refactor `FestivalManagement.tsx` and `Wallboard.tsx` into smaller chunks.
3.  **Medium:** Replace `any` with proper types in `src/types/`.
4.  **Low:** Standardize colors to Tailwind config.
