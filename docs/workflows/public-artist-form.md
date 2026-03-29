# Public Artist Form

> Tokenized public routes for artists to submit technical riders without authentication.

## Overview

The public artist form allows festival artists to submit their technical requirements and rider documents via a tokenized URL, without needing an account. Festival management generates time-limited tokens, sends links/QR codes, and artists fill out their gear requirements.

## Key Files

| Category | Path |
|----------|------|
| **Public route** | `/festival/artist-form/{token}` (no auth required) |
| **Form component** | `src/components/festival/ArtistForm.tsx` |
| **Link generation** | `src/components/festival/ArtistFormLinkDialog.tsx` |
| **Batch links** | `src/components/festival/ArtistFormLinksDialog.tsx` |
| **View submission** | `src/components/festival/ArtistFormSubmissionDialog.tsx` |
| **Requirements form** | `src/components/festival/ArtistRequirementsForm.tsx` |
| **Submit edge fn** | `supabase/functions/submit-public-artist-form/index.ts` |
| **Upload edge fn** | `supabase/functions/upload-public-artist-rider/index.ts` |
| **Delete edge fn** | `supabase/functions/delete-public-artist-rider/index.ts` |
| **URL generator** | `src/utils/publicArtistFormLinks.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `festival_artists` | Artist roster (name, date, stage, form_language) |
| `festival_artist_forms` | Form tokens (artist_id, token UUID, status, expires_at) |
| `festival_artist_form_submissions` | Submitted form data (form_id, artist_id, form_data JSONB) |
| `festival_artist_files` | Uploaded rider files (artist_id, file_name, file_path, file_type, file_size) |

**Storage bucket**: `festival_artist_files` — PDF, DOC, images, max 25MB, up to 10 per request.

## Token Lifecycle

```
1. GENERATE → Create festival_artist_forms row with UUID token, 7-day expiry, 'pending' status
2. ROTATE → Mark existing pending forms for same artist as 'expired'
3. DISTRIBUTE → Send link via email/QR code (URL: /festival/artist-form/{token}?lang=es|en)
4. VALIDATE → On access, check: token exists, status = 'pending', expires_at > now
5. SUBMIT → Mark form as 'submitted', insert to festival_artist_form_submissions
6. EXPIRE → Auto-expire past expiry date; prevent resubmission (409 if already submitted)
```

## Form Sections

1. **Basic Info**: Artist name, stage, date, schedule (show start/end, soundcheck times)
2. **FOH Console**: Model, provided by festival/artist
3. **Monitor Console**: Model, provided by festival/artist
4. **Wireless Systems**: Count, provided by
5. **IEM Systems**: Count, provided by
6. **Monitor Fills**: Count
7. **Wired Microphones**: Configurable per channel
8. **Infrastructure**: CAT6, HMA, coax cables, optical, analog
9. **Extras**: Side fill, drum fill, DJ booth
10. **Rider Upload**: PDF/image files
11. **Notes**: Free text

## Workflow

```
1. MANAGEMENT generates token via ArtistFormLinkDialog
   - 7-day expiry
   - Supports email sending with QR code
   - Printable blank template (PDF with QR)
   - Available in ES/EN

2. ARTIST receives link and opens form
   - No authentication required
   - Form pre-filled with artist name/date from festival_artists
   - Bilingual (es/en based on ?lang= param)

3. ARTIST fills technical requirements
   - Console, wireless, IEM, microphone specifications
   - Infrastructure needs
   - Free text notes

4. ARTIST uploads rider documents (optional)
   - POST to upload-public-artist-rider edge function
   - Token + file validated
   - Stored in festival_artist_files bucket

5. ARTIST submits form
   - POST to submit-public-artist-form edge function
   - Calls submit_public_artist_form RPC
   - Form data saved as JSONB
   - Token status → 'submitted'
   - Activity event: festival.public_form.submitted
   - Push notification to management

6. MANAGEMENT reviews submission
   - ArtistFormSubmissionDialog shows form data
   - Can download as PDF
   - Gear requirements visible in festival gear setup
```

## Security

- **Token-based**: No user session needed — UUID token is the auth mechanism
- **Time-limited**: 7-day default expiry
- **Single-use**: Cannot resubmit after submission (409 error)
- **Token rotation**: Generating a new token expires old ones
- **File validation**: Size limits, type whitelist applied by edge function

## Integration Points

- **Festival Management**: Submitted requirements feed into gear setup and microphone calculations
- **Activity Logging**: Form submissions and rider uploads trigger activity events
- **Push Notifications**: Management notified on submission
- **PDF Export**: Submissions exportable as PDF via ArtistFormSubmissionDialog
