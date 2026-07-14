# PDF font assets

`NotoSansPdf-Regular.ttf` is a static instance used by jsPDF for electrical
report notation. It is derived from the existing Noto Sans variable font in
this directory because jsPDF does not reliably embed variable-font instances.

The static file pins the source axes to `wght=400` and `wdth=100`. It can be
reproduced with FontTools:

```powershell
fonttools varLib.instancer "NotoSans-VariableFont_wdth,wght.ttf" wght=400 wdth=100 --output "NotoSansPdf-Regular.ttf"
```

The generated instance is then subset to Basic/Latin Extended-A, Greek, and
general punctuation (`U+0000-017F,U+0370-03FF,U+2000-206F`) to cover Spanish
report text and electrical notation while keeping the PWA asset budget bounded.

The embedded metadata identifies the copyright holder as the Noto Project
Authors and the license as the SIL Open Font License, Version 1.1. The reports
use this static file for Spanish/Latin text and the electrical notation
`1φ`, `3φ`, `ΣP`, and `ΣQ`.
