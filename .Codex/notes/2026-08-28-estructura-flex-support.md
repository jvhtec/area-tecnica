# Estructura Flex support

## Task summary

Added the operational Estructura hierarchy to standard jobs, tours, and tour dates; introduced source-discriminated Sound/Lights Pull Sheets; and routed manual/XMLP motor preparation plus automatic certificate manifests through those tracked documents.

## Files changed

- `supabase/migrations/20260828135121_add_estructura_flex_support.sql`
- `src/domain/estructura.ts`
- `src/utils/flex-folders/folder-creation/createEstructuraFolders.ts`
- `src/utils/flex-folders/folder-creation/createStandardJobFolders.ts`
- `src/utils/flex-folders/folder-creation/createTourdateFolders.ts`
- `src/hooks/tours/useTourCreationMutation.ts`
- `supabase/functions/create-flex-folders/index.ts`
- `src/components/jobs/cards/job-card-actions/PrepareMotorsAction.tsx`
- `src/services/estructuraMotorPreparation.ts`
- `src/components/sound/amplifier-tool/rack-designer/XmlpFlexExportDialog.tsx`
- `supabase/functions/fetch-flex-motor-units/index.ts`
- `docs/workflows/estructura-motor-preparation.md`

## Decisions made

- Estructura is an operational Flex department, not a user-selectable staffing department. Folder creation therefore runs independently of selected job departments.
- The two Estructura Pull Sheets are distinguished by `source_department` (`sound` or `lights`) and protected by a partial unique index per job/source.
- Manual motor pushes are additive and independent per source so one failed destination does not erase a successful push to the other.
- Automatic certificates read outbound manifests only from the tracked Estructura Pull Sheets. The manual certificate fallback remains available.
- XMLP motor rows route only to Estructura Sound. Bumpers, rigging hardware, and ordinary Sound rows continue to use the selected Sound destination.

## Patterns discovered

- Tour Flex creation has three active paths: the privileged `create-flex-folders` Edge Function, the manual helper in `src/utils/tourFolders.ts`, and the direct creation hook in `src/hooks/tours/useTourCreationMutation.ts`. Operational hierarchy changes must cover all three.
- Tour-date folder reconciliation should prefer `tour_date_id` over folder names and adopt the linked job ID when an Edge-created row is reused.
- Edge Functions can import the shared Estructura domain constants from `src/`; both modified functions were compiled through the local Supabase runtime.

## Gotchas

- Regenerating `src/integrations/supabase/types.ts` from a clean local reset also captured pre-existing local/committed generated-type drift, so its diff is larger than the two new fields alone.
- XMLP import selections live only in component memory. They cannot safely prefill a later job-card dialog without adding a persistence contract.
- Existing tours may have `flex_folders_created = true` without Estructura. Reconciliation must still check and create the missing Estructura root.

## Follow-up items

- Add controller/cable models only after approved Flex model IDs and business quantity rules are supplied.
- Consider extracting the Estructura portions of the large tour Edge handler and the XMLP dialog during a dedicated refactor; no unrelated restructuring was included here.
- No AGENTS.md update is needed: these are feature-specific rules documented in the Flex and motor workflow documentation.
