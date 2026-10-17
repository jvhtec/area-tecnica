# Outlook / iOS → Área Técnica: binary file handoff

This replaces the older 44-action Shortcut, whose malformed conditions stopped execution and whose multipart POST produced an HTTP 400 with no attachment.

## User flow

1. Install the [Apple-signed shortcut](https://syldobdcdsgfgjtbuwxm.supabase.co/functions/v1/ios-share-shortcut-handoff).
2. Open it in Shortcuts and replace the **first Text action** `PASTE_ATI_DEVICE_TOKEN_HERE` with the device-specific `ati_...` token created in **Área Técnica → Perfil → Seguridad → Importar documentos desde iOS**.
3. In Outlook, open an attachment, choose **Share**, then **Enviar a Área Técnica (v4)**.
4. Shortcuts sends the original file bytes to `ios-share-handoff?raw=1&plain=1&filename=<URL-encoded name>` with `X-Share-Token`.
5. The server stores an unregistered, private, time-limited staging object and returns a **plain-text HTTPS URL**, never a JSON object whose `url` property must be extracted.
6. The Shortcut converts the returned text to a URL and opens Safari. If the transfer failed, the server instead returns a URL to a readable **error page** (e.g. `invalid_token`, `missing_file`), not an empty input to the Open URL action.
7. In Safari, the user chooses the job/date, department or rider, artist and optional date/stage. Only **Guardar archivo** triggers `mode=commit`.
8. Commit downloads the staged bytes and calls the existing `ios-share-import` service with the same opaque device token and deterministic request ID. The existing importer performs role checks, job validation, deduplication, document/rider routing, and registration. On successful confirmation, staging is removed.

The Shortcut has **9 native actions**, with no conditional blocks, no setup wizard, and no dictionary lookups. Input can be any supported shared file type; file-extension restrictions are not introduced. Each attachment is capped at 45 MiB.

## Security and lifecycle

- Filename metadata from Outlook may arrive missing or malformed. The server uses a safe fallback (`Adjunto_Outlook_...` with a MIME/signature-based extension when identifiable), without changing file contents. The selection page allows editing the filename before final commit.
- URL query parameters are decoded **once**. Avoid a second `decodeURIComponent`, which can turn a legitimate literal `%2F` in the filename into a slash.
- Error pages declare UTF-8 explicitly so iOS displays Spanish accents correctly.
- The device credential is entered **on the user's device**, not present in the distributed shortcut.
- The device credential is required for initial upload and is validated against its SHA-256 hash, current profile role, expiration, and revocation; stage uploads are limited to 40/hour per device.
- The browser ticket is AES-GCM encrypted (key derived from the service-role secret, random IV), includes the original filename, size and staging path, and expires after **one hour**. It also carries the device token, but only inside the sealed payload: the URL never exposes it in plaintext. Every ticket use re-validates that token (revocation, expiry, current role), so revoking the device kills outstanding tickets. Treat a ticket URL as sensitive for its hour.
- Storage is the existing **private** `job_documents` bucket under `ios-stage/YYYY-MM-DD/<UUID>`. Temporary files are never registered as `job_documents`; confirmed documents use the original importer.
- A successful import removes its staging blob. Abandoned objects are opportunistically purged after two days by staging requests. The `mode=discard` endpoint can remove the blob with the valid ticket.
- The public Shortcut download (`ios-share-shortcut-handoff`) is rate limited (30 requests/hour per client, fail closed) because every request calls the third-party signer.
- Avoid caching responses and leaking ticket URLs in referrers. Do not share an installed shortcut after inserting the secret.

## API

| Action | Request | Response |
| --- | --- | --- |
| Stage | `POST ?raw=1&plain=1&filename=...` with binary request body, `X-Share-Token` | `text/plain` canonical HTTPS ticket URL; failure maps to HTTPS error page |
| Open page | `GET ?ticket=...` | Job/rider selection UI |
| Info | `GET ?ticket=...&mode=info` | File name, size and expiry of the staged file |
| Jobs | `GET ?ticket=...&mode=jobs&destination=...` | Authenticated JSON from `ios-share-import` |
| Commit | `POST ?ticket=...&mode=commit` with JSON job/department/artist | Real backend result, `ok:true` only on confirmed registration |
| Discard | `POST ?ticket=...&mode=discard` | Remove temporary file |
| Health | `GET ?check=1` | No user details |

## Verification and deployment

- Confirmed Apple signer returns AEA1: nine actions, a File request body with `WFRequestVariable`, encoded filename, URL action and Open URL; no `conditional` or import questions.
- Confirmed server responds with the canonical public **HTTPS /functions/v1/** path, including for errors, not the internal runtime's `http://...` path.
- Confirmed unauthorized raw POST reaches the handler and returns a navigable error link; the error page renders.
- **Still requires a real Outlook/iPhone file-upload test with the user's token.** Signature validation alone is not execution validation.

Both new functions have `verify_jwt=false` intentionally. Staging verifies `X-Share-Token` internally; the signer distributes only a credential-free shortcut. Keep their `supabase/config.toml` and governance entries aligned before any subsequent deployment.

See also [original import contract](ios-shortcuts-document-import.md) and issue #1009.
