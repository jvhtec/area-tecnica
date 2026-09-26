# Hoja de Ruta Roadmap Completion

This report closes the roadmap that followed PRs #955 and #957. It records implementation evidence and the production work that remains intentionally human-operated.

## Completed Scope

| Area | Result | Evidence |
|---|---|---|
| Data-loss prevention | Restaurant, image, staff, routed-job, and dirty-state data use the aggregate document flow. Legacy transient image rows survive unrelated saves. | `useHojaDeRutaImages.ts`, `save_hoja_de_ruta(..., removed_image_ids)` |
| Persistence | Atomic optimistic save, aggregate read, stable child IDs, ordering, room FKs, structured dates, conflict recovery, and pgTAP coverage. | Hoja migrations and `supabase/tests/database/hoja_de_ruta_hardening.sql` |
| Architecture | Canonical document controller, scoped reducer state, registry-driven navigation/completeness/exports, object export APIs, dead filename heuristics removed, and legacy tables retired from authenticated access. | `src/features/hoja-de-ruta/`, `src/utils/hojaDeRutaExport.ts` |
| Integrations | Logistics, producer contacts, published-document pointers, Tour Ops aggregate reads, staffing/power drift, weather freshness, status workflow, and durable Programa IDs. | PR #957 plus completion migration |
| UX | Embedded/mobile shell, all leave guards, semantic status tokens, reduced motion, accessible section navigation, grouped staff, masked DNI, contact shortcuts, validation, and conflict actions. | Hoja components and focused unit tests |
| Privacy | DNI excluded from general PDF/XLS and technician projection. Dedicated accreditation XLS is local-only and confirmed. Hoja production logging is redacted. | Export tests, pgTAP projection tests, logging sweep |
| Authorization | Centralized role helper, management-only direct-table policies, technician restricted aggregate, explicit grants, and anonymous revocation. | `20260926144902_complete_hoja_roadmap.sql` |
| Quality | Mapper/save contracts, validation, grouping, masking, leave guards, accreditation, pgTAP, critical-suite registration, and Hoja Playwright workflow. | `package.json`, unit/database/e2e tests |

## Production Image Inventory

Read-only inventory captured on 2026-09-26 before this completion migration:

- 73 legacy image rows total.
- 16 `data:` rows can be migrated automatically after deployment.
- 57 `blob:` rows cannot be dereferenced outside the browser session that created them.
- 0 rows were already durable storage paths at the time of the inventory.

The save RPC preserves all legacy `blob:` and `data:` rows unless the editor explicitly removes their IDs. The migration utility reports `blob:` row IDs without emitting their contents. Operations must source the original files; no server-side process can reconstruct them. Recovered files named `<image-uuid>.(jpg|jpeg|png|webp)` can be supplied through `--blob-dir <path>` so the utility replaces the original row instead of creating a duplicate.

## Production Rollout

The PR author or release operator must perform these steps after merge. Agents do not merge or apply production migrations.

1. Confirm all PR CI, CodeQL, security, and review checks are green.
2. Preview the database change:
   `npx supabase db push --linked --dry-run`
3. Apply the migration through the approved production release path.
4. Confirm no migration remains pending with another linked dry run and `npx supabase migration list --linked`.
5. Run Supabase security and performance advisors. The completion migration should remove the Hoja duplicate-policy/init-plan findings; authenticated SECURITY DEFINER warnings for the guarded aggregate RPCs are intentional API exposure.
6. Inventory the legacy images without writes:
   `npm run hoja:migrate-images`
7. Migrate valid `data:` rows:
   `npm run hoja:migrate-images -- --apply`
8. Re-run the dry run. It should report no remaining valid `data:` rows and list the preserved `blob:` rows requiring manual re-upload.
9. Dry-run and apply any recovered `blob:` originals:
   `npm run hoja:migrate-images -- --blob-dir <recovered-files-directory>`
   `npm run hoja:migrate-images -- --blob-dir <recovered-files-directory> --apply`
10. Smoke-test manager save/reload, status transition, conflict reload/overwrite, section download, accreditation export, assigned-technician projection, mobile back navigation, and embedded dialog dismissal.

The completion migration does not change or deploy Edge Functions, so no function deployment is required for this PR.
