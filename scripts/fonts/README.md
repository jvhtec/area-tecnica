# Font sources (build-time only)

These variable fonts are **source material**, not shipped assets. Nothing in
`src/` imports them and no runtime code fetches them — they exist solely to
regenerate the static instance that the PDF exporter loads.

They previously sat in `public/`, which meant Vite copied all 4.3 MB into every
deploy for no runtime benefit. Keep them here.

## Regenerating the PDF font

`public/fonts/NotoSansPdf-Regular.ttf` is derived from
`NotoSans-VariableFont_wdth,wght.ttf`. jsPDF does not reliably embed
variable-font instances, so the axes are pinned first.

Run everything below from the repository root, so the paths resolve the same
way regardless of your shell's working directory:

```bash
fonttools varLib.instancer "scripts/fonts/NotoSans-VariableFont_wdth,wght.ttf" \
  wght=400 wdth=100 --output "scripts/fonts/NotoSansPdf-Regular.ttf"
```

Then subset to the ranges the Spanish reports and electrical notation need,
which is what keeps the shipped file at ~85 KB rather than ~600 KB:

```bash
fonttools subset "scripts/fonts/NotoSansPdf-Regular.ttf" \
  --unicodes="U+0000-017F,U+0370-03FF,U+2000-206F" \
  --output-file="public/fonts/NotoSansPdf-Regular.ttf"
```

The intermediate `scripts/fonts/NotoSansPdf-Regular.ttf` is a scratch file —
only the subset copy under `public/fonts/` is committed and shipped.

## License

Noto Sans is licensed under the SIL Open Font License, Version 1.1, by the Noto
Project Authors. The license metadata is preserved in the generated instance.

## A note on the italic face

`NotoSans-Italic-VariableFont_wdth,wght.ttf` is retained for completeness but is
not currently used by any generated asset. If no italic instance is ever needed,
it can be deleted — Google Fonts remains the canonical source for both files.
