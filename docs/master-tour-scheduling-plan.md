# Master Tour Scheduling Feature Parity Plan

## Overview
This plan aligns the Área Técnica scheduling work with the existing Hoja de Ruta data model and clarifies the permission rules for the new editing experience. We will reuse the Hoja de Ruta tables—primarily `hoja_de_ruta` and its JSON schedule payload—instead of creating new schedule tables. Timeline features in the React client, Hoja de Ruta editor, and PDF generator will all operate on that shared source of truth. Only users with the global roles `admin` or `management` will be allowed to edit the schedule.

## Data Model Integration
- **Primary source of truth**: Continue storing daily schedule information in `hoja_de_ruta.program_schedule_json` (already exposed to the client as `programScheduleDays`).
- **Timeline blocks**: The new timeline UI will read and write the same JSON structure that powers the Hoja de Ruta editor. Each block represents a row inside a `ProgramDay` entry.
- **Optional metadata**: If we need to persist additional per-event metadata (e.g., confirmation status, type tags, reminders), extend the JSON schema within `program_schedule_json` and update the TypeScript definitions in `src/types/hoja-de-ruta.ts` accordingly. Only introduce new SQL columns on `hoja_de_ruta` or related detail tables when the data must be queryable outside the schedule JSON.
- **Curfew/afterparty**: Treat these items as named rows inside the JSON payload. If we decide to surface quick-access fields on the Hoja de Ruta detail view, add nullable columns such as `curfew_time` or `afterparty_details` directly on `hoja_de_ruta`, and ensure the UI mirrors them in the timeline (auto-creating or updating the corresponding JSON rows).
- **Legacy data**: Existing Hoja de Ruta records already contain schedule rows. The timeline feature must load those rows without migration. Any schema extensions must default safely so older documents remain valid.

## Application Flow Updates
- **Shared hooks**: Extend `useHojaDeRutaPersistence` to expose helper methods for manipulating `programScheduleDays` so both the editor and the new timeline can reuse identical read/write logic.
- **Timeline component**: Build the scheduling UI on top of the JSON data returned by Hoja de Ruta queries. Whenever a user adds, edits, drags, or deletes a block, call the persistence helpers to update `program_schedule_json` and trigger Supabase updates.
- **Real-time sync**: Subscribe to changes on `hoja_de_ruta` rows (filtered by job/tour) so viewers receive live schedule updates. Because the JSON blob remains the authoritative field, a single channel keeps the editor, timeline, and PDF generator in sync.
- **Hoja de Ruta editor**: Audit the existing editor to ensure any structural changes to the JSON are backwards compatible and reflected in its UI controls.
- **PDF export**: Continue reading schedule rows from `programScheduleDays` when composing itinerary PDFs. Any new metadata that needs to appear in print must be handled by the PDF builders in `src/utils/hoja-de-ruta/pdf`.

## Permissions
- **Editable roles**: Limit schedule modifications to users whose `profiles.role` (as surfaced by `useOptimizedAuth`) is either `admin` or `management`.
- **UI gating**: Pass a boolean `canEditSchedule` down to the timeline and Hoja de Ruta components. Hide drag handles, add/delete buttons, and edit forms for all other roles.
- **RLS policies**: Update Supabase Row Level Security on `hoja_de_ruta` and any child tables we touch so that only `admin` and `management` roles can perform INSERT/UPDATE/DELETE operations on schedule fields. Leverage existing role checks in stored policies to avoid duplicating logic.

## Implementation Steps
1. **TypeScript alignment**: Document and extend the `ProgramDay`/`ProgramRow` interfaces in `src/types/hoja-de-ruta.ts` to cover any new schedule metadata.
2. **Hook utilities**: Centralize JSON manipulation helpers in `useHojaDeRutaPersistence` so the timeline and editor rely on the same update path.
3. **Timeline UI**: Build the React timeline component that consumes `programScheduleDays`, supports drag-and-drop editing for authorized users, and triggers persistence updates.
4. **Curfew/afterparty plumbing (optional)**: If quick fields are required, add nullable columns to `hoja_de_ruta`, sync them with JSON rows, and update both the editor and PDF code paths.
5. **Permissions**: Enforce the `admin`/`management` edit rule in both the frontend (conditional controls) and Supabase RLS policies.
6. **Testing**: Extend the existing unit and integration tests to cover JSON manipulation, permission gating, and PDF output with the enriched schedule data.

By reusing the established Hoja de Ruta storage model and clarifying the authorized roles, we ensure the new timeline experience stays in lockstep with the rest of the scheduling workflow—no duplicate datasets and no ambiguity about who can edit.
