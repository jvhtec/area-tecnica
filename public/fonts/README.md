# PDF font assets

`NotoSansPdf-Regular.ttf` is a static instance used by jsPDF for electrical
report notation. It is the **only** font in this directory, and the only one
that ships: everything under `public/` is served to every visitor, so the
variable fonts it is generated from live in `scripts/fonts/` instead and are
never deployed. See `scripts/fonts/README.md` for how to regenerate this file.

The static file pins the source axes to `wght=400` and `wdth=100`, then subsets
to Basic/Latin Extended-A, Greek, and general punctuation
(`U+0000-017F,U+0370-03FF,U+2000-206F`) to cover Spanish report text and
electrical notation while keeping the PWA asset budget bounded.

The embedded metadata identifies the copyright holder as the Noto Project
Authors and the license as the SIL Open Font License, Version 1.1. The reports
use this static file for Spanish/Latin text and the electrical notation
`1φ`, `3φ`, `ΣP`, and `ΣQ`.

`src/utils/pdf/pdfUnicodeFont.ts` is the only consumer. It fetches
`/fonts/NotoSansPdf-Regular.ttf` inside `registerPdfUnicodeFont`, which runs
when a report is generated — not on page load. Adding a font here therefore
costs deployed asset size rather than startup time, and is paid at PDF-export
time by the users who generate reports. Prefer generating a subset instance
over shipping a full face.
