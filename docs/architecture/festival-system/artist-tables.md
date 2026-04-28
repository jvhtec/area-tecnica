# Festival Artist Tables & Workflow Architecture

This document covers the **artist-side architecture**: roster data, form tokens, submissions, and file uploads.

## 1) Data model (artist domain)

### `festival_artists` (primary roster record)

Main row per artist/date/stage with technical request fields.

Representative field groups:

- Identity/scheduling: `name`, `job_id`, `date`, `stage`, `show_start`, `show_end`, `soundcheck_*`.
- Console and monitoring: `foh_console`, `mon_console`, `monitors_enabled`, `monitors_quantity`.
- RF/IEM/mics: `wireless_systems`, `iem_systems`, `wired_mics`, `mic_kit`.
- Infrastructure: `infra_cat6_*`, `infra_hma_*`, `infra_coax_*`, `infra_opticalcon_duo_*`, `infra_analog`.
- Extra requirements: `extras_sf`, `extras_df`, `extras_djbooth`, `extras_wired`.
- Submission/language context: `form_language`, `notes`, rider metadata.

### `festival_artist_forms` (token records)

Stores the public-form token lifecycle for an artist form request.

Typical responsibilities:

- Token creation + expiry.
- Pending/submitted/expired lifecycle tracking.
- Traceability per artist.

### `festival_artist_form_submissions` (submitted payload)

Stores canonical submissions and associated metadata after the public form is sent.

### `festival_artist_files` (rider uploads)

Stores rider and supplemental file metadata (name/path/type/size/upload provenance).

## 2) Main UI modules

- Internal management table/list/edit:
  - `src/components/festival/ArtistTable.tsx`
  - `src/components/festival/ArtistManagementDialog.tsx`
  - `src/components/festival/ArtistManagementForm.tsx`
  - `src/components/festival/CopyArtistsDialog.tsx`
- Public/private form flow:
  - `src/components/festival/ArtistForm.tsx`
  - `src/components/festival/ArtistRequirementsForm.tsx`
  - `src/components/festival/ArtistFormLinkDialog.tsx`
  - `src/components/festival/ArtistFormLinksDialog.tsx`
  - `src/components/festival/ArtistFormSubmissionDialog.tsx`
- Rider file UX:
  - `src/components/festival/ArtistFileDialog.tsx`
  - `src/components/festival/ViewFileDialog.tsx`

## 3) Public form workflow (end-to-end)

```text
Manager creates/refreshes token
  → Artist receives tokenized URL
    → Artist opens public form (no login)
      → Artist completes requirements + uploads rider files
        → Submission is persisted and linked to artist/form
          → Management reviews from internal festival UI
```

## 4) Public form backend integration points

- `supabase/functions/submit-public-artist-form/index.ts`
- `supabase/functions/upload-public-artist-rider/index.ts`
- `supabase/functions/delete-public-artist-rider/index.ts`

These functions enforce token validity, submission lifecycle guarantees, and file operation rules.

## 5) Operational patterns

- Keep the `festival_artists` row as the human-readable planning source.
- Keep full form payload in submission tables for auditability and evolution.
- Never assume one artist = one immutable token; treat token rows as lifecycle records.
- Rider files are artifacts attached to artist context, not substitutes for structured fields.

## 6) Consumer systems fed by artist data

- Gear analysis/mismatch system.
- Festival PDF and table exports.
- Shift planning context (stage/date load).
- Activity/event feed and management notifications.
