# Festival Flex Integration Architecture

This document explains how Festival management connects to Flex for folders, element navigation, pullsheet sync, and mismatch-driven commercial quote creation.

## 1) Integration surfaces in festival UX

- Festival orchestration uses Flex folder context through:
  - `src/pages/festival-management/useFestivalManagementVm.ts`
- Flex push operation for gear:
  - `src/components/festival/PushToFlexPullsheetDialog.tsx`
- Flex folder helpers and navigation:
  - `src/utils/flex-folders/*`
  - `src/hooks/useFlexUuid.ts`
  - `src/utils/flexMainFolderId.ts`

## 2) Pullsheet push flow

Primary service path:

- UI gathers selected gear sections and target pullsheet (`PushToFlexPullsheetDialog`).
- Pullsheet targets are discovered with `getJobPullsheetsWithFlexApi`.
- URL mode or selector mode resolves element ID (`extractFlexElementId`).
- Equipment rows are mapped and sent via `pushEquipmentToPullsheet`.

## 3) Folder/element workflow integration

Festival jobs share platform-level job folder behavior:

- Resolve/create Flex folder structure for the job.
- Store local mirror rows in `flex_folders`.
- Allow opening selected element(s) in Flex via helper utilities.

## 4) Reliability and guardrails

- Async load states prevent stale updates while dialog context changes.
- Input mode fallback (`select` or `url`) keeps operation possible even when selector data is unavailable.
- Push result tracks success and failures per equipment item for post-action troubleshooting.

## 5) Recommended operating workflow

```text
Verify festival gear setup
  → Open Push to Flex dialog
    → Choose pullsheet (selector or URL)
      → Select gear sections to export
        → Execute push and review result summary
          → Retry failed items or adjust local mappings
```

## 6) Create Extras Quote integration

Mismatch-driven quote creation is implemented through:

- UI trigger in artist actions (desktop/mobile) when mismatch severity includes `error`.
- Hook: `src/hooks/festival/useCreateExtrasPresupuesto.ts`.
- Folder strategy: reuse/create `comercial_extras` and then create a `comercial_presupuesto` element.
- Persistence: write every created element to `flex_folders` (`folder_type`: `comercial_extras` / `comercial_presupuesto`).
- Concurrency hardening: module-level per-job queue avoids duplicated quote ordinals.

This is effectively the commercial escalation path from technical conflicts to actionable Flex quote artifacts.

## 7) Related references

- `docs/flex-folder-workflows.md` (cross-system folder architecture)
- `docs/FLEX_SELECTOR_INTEGRATION.md` (selector behavior details)
