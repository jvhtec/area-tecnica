# Motor certificate manufacturer data and branding

This note complements [Individual Motor Inspection Certificates](motor-certificates.md) with the manufacturer/model enrichment added to the certificate identity page.

## Flex metadata

For every configured certified motor model, `fetch-flex-motor-units` reads the Flex `inventory-model/{modelId}` endpoint before loading its serialized units. The response supplies:

- the current Flex display name used as the certificate model,
- the manufacturer name,
- and the existing model ID used by the fixed certificate allowlist.

If the inventory-model metadata request fails, the workflow keeps the configured allowlist name and returns a null manufacturer rather than blocking serial-unit retrieval. Serial numbers, barcodes and manifest matching still come from the existing Flex serial-unit and manifest endpoints.

The client also normalizes an omitted `manufacturer` field to `null`. This keeps the rollout compatible when the frontend reaches production before the updated Edge Function. A present but non-string manufacturer remains an invalid response.

## Supplied brand assets

The PDF generator bundles the supplied artwork for these three brands:

- ChainMaster,
- LIFTKET,
- CM.

The source images were normalized to PDF-compatible PNG or JPEG files without redesigning the marks. The binary files live under `src/assets/motor-brands/`; `src/utils/pdf/motorBrandLogos.ts` registers their MIME types and Vite URLs. The `?no-inline` imports keep the image bytes out of the JavaScript bundle.

Brand matching uses the Flex manufacturer and model text. Recognised aliases include ChainMaster/Chain Master, LIFTKET, and CM/Columbus McKinnon/Lodestar. An unknown brand remains fully usable and simply produces a certificate without a manufacturer logo. Failure to load or embed a recognised local asset has the same non-blocking fallback.

## PDF hierarchy

The first page now presents:

1. SATPRO as the inspection certificate issuer in the page header,
2. manufacturer and model from Flex in the motor-details panel,
3. the equipment brand logo in that panel's upper-right corner when recognised,
4. the serial number as the dominant unit identity,
5. the Flex barcode when available,
6. inspection and next-inspection dates.

The brand logo identifies the equipment only; placing it inside the motor-details panel keeps it visually separate from the SATPRO issuer header. The text explicitly states that brand and model data come from the Flex inventory record. The second page is now generated from the matching manufacturer checklist and cites the applicable manual revision; the authorised SATPRO signature and seal are reproduced from the checksum-pinned archived 2026 acta instead of copying its obsolete Yale table.

## Deployment and maintenance

Changes to this metadata flow require deployment of the `fetch-flex-motor-units` Edge Function. No database migration is required.

To add another supported brand:

1. obtain an approved logo asset and store it under `src/assets/motor-brands/`,
2. add its non-inlined URL and MIME type to `MOTOR_BRAND_LOGOS`,
3. extend `MotorBrandKey` and `resolveMotorBrandKey`,
4. add its sourced checklist to `public/certificates/motor-inspection-checklists-2026.json`,
5. add a PDF test for the brand,
6. visually inspect a representative certificate.

Do not fetch logos from manufacturer or other third-party sites during certificate generation. The generator loads only the bundled same-origin assets, which keeps output deterministic and independent of manufacturer websites.
