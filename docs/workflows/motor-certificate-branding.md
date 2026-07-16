# Motor certificate manufacturer data and branding

This note complements [Individual Motor Inspection Certificates](motor-certificates.md) with the manufacturer/model enrichment added to the certificate identity page.

## Flex metadata

For every configured certified motor model, `fetch-flex-motor-units` reads the Flex `inventory-model/{modelId}` endpoint before loading its serialized units. The response supplies:

- the current Flex display name used as the certificate model,
- the manufacturer name,
- and the existing model ID used by the fixed certificate allowlist.

If the inventory-model metadata request fails, the workflow keeps the configured allowlist name and returns a null manufacturer rather than blocking serial-unit retrieval. Serial numbers, barcodes and manifest matching still come from the existing Flex serial-unit and manifest endpoints.

## Supplied brand assets

The PDF generator contains the exact artwork supplied for these three brands:

- ChainMaster,
- LIFTKET,
- CM.

The source images were only cropped/compressed or converted to a PDF-compatible format. They were not redrawn or generated. They are stored as local embedded image data in `src/utils/pdf/motorBrandLogos.ts`, so certificate generation does not depend on an external image host.

Brand matching uses the Flex manufacturer and model text. Recognised aliases include ChainMaster/Chain Master, LIFTKET, and CM/Columbus McKinnon/Lodestar. An unknown brand remains fully usable and simply produces a certificate without a manufacturer logo.

## PDF hierarchy

The first page now presents:

1. SATPRO as the inspection certificate issuer,
2. the equipment brand logo when recognised,
3. manufacturer and model from Flex,
4. the serial number as the dominant unit identity,
5. the Flex barcode when available,
6. inspection and next-inspection dates.

The brand logo identifies the equipment only. The text explicitly states that brand and model data come from the Flex inventory record; the signed SATPRO maintenance page remains the unchanged second page for each motor.

## Deployment and maintenance

Changes to this metadata flow require deployment of the `fetch-flex-motor-units` Edge Function. No database migration is required.

To add another supported brand:

1. obtain an approved logo asset,
2. add it to `MOTOR_BRAND_LOGOS`,
3. extend `MotorBrandKey` and `resolveMotorBrandKey`,
4. add a PDF test for the brand,
5. visually inspect a representative certificate.

Do not fetch logos dynamically during certificate generation. Local assets keep output deterministic and avoid broken certificates when a manufacturer changes its website, which manufacturers apparently regard as a public service.
