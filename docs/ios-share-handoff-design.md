# iOS document handoff

Safari on iOS cannot act as a file share target for a PWA. The reliable solution is a small native Shortcut to upload the binary file into private temporary storage, then open a browser page for selecting the job and document type. Reuse the existing `ios-share-import` server-side authorization, validation and idempotency checks. Never put a long-lived device token in a browser URL.
