# Responsable de Producción (Job Producer Claims)

> Which production-department user is carrying a job, and how the crew reaches them.

## Overview

A **responsable de producción** is the production-department user who owns a job operationally — the person crew asks about anything that is not technical (schedules, catering, access, paperwork, the client).

Ownership is recorded as a *claim*: a row in `job_producer_claims` linking a job to a production profile. Claims are deliberately **independent from staffing**. Claiming a job never creates a `job_assignment`, `timesheet`, rate row, or staffing campaign side effect, and releasing one never deletes any. A job can carry several claims at once; `dry-hire` jobs can carry none.

## Key Files

| Category | Path |
|----------|------|
| **Data layer** | `src/features/jobs/producer-claims/producerClaims.ts` |
| **Claim/assign hook** | `src/features/jobs/producer-claims/useJobProducerClaims.ts` |
| **Claim control (management)** | `src/components/jobs/producer-claims/JobProducerClaims.tsx` |
| **Job card** | `src/components/jobs/cards/job-card-new/JobCardNewView.tsx`, `JobCardNewDetailsOnly.tsx` |
| **Job details dialog** | `src/components/jobs/job-details-dialog/tabs/JobDetailsInfoTab.tsx` |
| **Tech super app panel** | `src/components/technician/details-modal/ProducerContactPanel.tsx` |
| **Tech modal data** | `src/components/technician/details-modal/useDetailsModalData.ts` |
| **Phone / WhatsApp links** | `src/utils/phoneLinks.ts` |
| **Document contacts** | `mergeProducerClaimsIntoContacts` in `producerClaims.ts`, used by `src/features/hoja-de-ruta/exports/useHojaDocumentExports.ts` |
| **Permissions** | `canAssignJobProducerClaims`, `isProductionDepartment` in `src/utils/permissions.ts` |

## Database

| Object | Purpose |
|--------|---------|
| `job_producer_claims` | `(job_id, producer_id)` primary key, `claimed_at`. No `UPDATE` privilege — a claim is immutable, you release and re-claim. |
| `get_job_producer_claims(uuid[])` | Name-only projection (`job_id`, `producer_id`, `display_name`) for any authenticated caller. Used by job lists and cards. |
| `get_job_producer_contacts(uuid[])` | Same rows **plus `phone` and `email`**, released per row only to operational roles (`admin`/`management`/`logistics`), the producer themselves, technicians assigned to that job, and drivers with a live (non-declined) `transport_driver_assignments` row on one of the job's `logistics_events`. |
| `enforce_job_producer_claim_department()` | `BEFORE INSERT/UPDATE` trigger. Rejects non-production profiles and dry-hire jobs, and takes `FOR NO KEY UPDATE` on the job row so a claim and a dry-hire conversion serialize. |
| `remove_job_producer_claims_for_dryhire()` | `AFTER UPDATE OF job_type ON jobs` trigger. Drops every claim when a job becomes dry-hire. |

Migrations: `20260914095450_add_job_producer_claims.sql`, `20260915092603_harden_job_producer_claims.sql`, `20260915154500_add_job_producer_contact_directory.sql`, `20260924123000_conductor_dashboard_navigation.sql` (driver entitlement).
pgTAP coverage: `supabase/tests/database/job_producer_claims.sql`.

### Why two RPCs

`profiles.phone` and `profiles.email` are private — the `profiles_select` policy (migration `20260904162000`) limits direct row access to the owner, operational administrators, and technicians who share a job. `get_profile_directory()` exists precisely so name-only consumers never touch those columns.

`get_job_producer_contacts()` is the narrow exception: it releases contact details for *one* job's producers, to callers who have a reason to contact them. Anything that only needs a name must keep using `get_job_producer_claims()`.

## Authorization

| Action | Who |
|--------|-----|
| Read claim names | Any authenticated user |
| Read producer phone/email | `admin` / `management` / `logistics`, the producer, a technician assigned to that job, or a driver with a live transport assignment on it |
| Claim a job for yourself | Any production-department user |
| Assign a production peer | Production-department users with role `management` only — **not** `admin` |
| Release a claim | Only the claimant |
| Any claim on a `dry-hire` job | Nobody — rejected by trigger, and existing claims are dropped on conversion |

Both the RLS policy and the trigger enforce the department rule, so bypassing policy evaluation is not enough to create an invalid claim.

The department check accepts `production`, `produccion` and `producción` — historical profile rows use all three spellings. Use `isProductionDepartment` in app code rather than comparing strings.

## Where it surfaces

**Job cards and the job details dialog** (`JobProducerClaims`) show `Producción: <names>` or `Sin responsable`, with a *Hacerme cargo* / *Dejar de llevarlo* toggle for production users and an *Asignar* select for production management.

**Tech super app** (`ProducerContactPanel`, Info tab of the job details modal) shows every producer carrying the job with, when the profile has them, shortcuts to WhatsApp (`wa.me`, prefilled with the job title), phone (`tel:`) and email (`mailto:`). The block is hidden entirely when nobody has claimed the job, and shows *Sin datos de contacto en su perfil* when a producer's profile has neither number nor address. Numbers are normalized to E.164 by `src/utils/phoneLinks.ts`, which mirrors the Spain-default normalization in the `send-job-whatsapp-message` edge function.

**Generated documentation.** `buildDocumentEventData` in `useHojaDocumentExports.ts` merges the producers into the Hoja de Ruta contact list before every export, so the PDF, the print preview and the XLS all list them under *Producción* with their phone (and email, in the XLS, which has that column). A producer already listed from job staffing is not duplicated — their phone/email are backfilled onto the existing row instead.

## Gotchas

- **Never let a claim create staffing rows.** The separation is the whole point of the feature; a pgTAP assertion guards it.
- **Claims are additive, not exclusive.** Render a list, not a single name.
- **`get_job_producer_contacts` returning nothing is normal**, not an error — it is how the RPC denies a caller who is not entitled to the job. Fail soft.
- **`admin` is not production management.** `canAssignJobProducerClaims` requires role `management` *and* the production department.
