# Soundvision XMLP → Flex equipment package

## Data flow and ownership

```text
Sound job-card XMLP action
  ↓ transient parse-la-session Edge Function
normalized NwmMap (React memory only)
  ├─ Pesos tables + structured motors
  ├─ Consumos tables + structured PDUs
  └─ pure XMLP Flex export planner
       ↓ exact equipment/resource resolution
     inspectable selection preview
       ↓ strict grouped writer
     Pull Sheet or Presupuesto

Separate NM/SV designer
  ↓ same parse-la-session boundary
rack layout + flysheet PDF (no Flex export action)
```

`parse-la-session` remains the only XMLP decryption/parser boundary. The browser keeps the normalized result only for the mounted rack-designer workflow. Raw uploads, decrypted XML, keys, and the complete normalized project are not written to localStorage or Supabase by this feature.

The full package action is owned by the Sound tab's job-card actions in Project Management. It is rendered only for the `sound` department and passes that card's `job.id` into the workflow, so document discovery is scoped to the selected job. Clicking it opens a dedicated XMLP-only import screen and then the package review; it never mounts the NM/SV rack designer. The standalone Sound rack designer retains NM/SV layout and flysheet functions but does not expose Flex export.

Within the job-scoped workflow, the full package action requires an imported XMLP with flysheet data. NWM continues to support rack-layout import but does not enable the package action.

## Pure plan

`src/features/technical-tools/flex/xmlpFlexExportPlan.ts` accepts a normalized `NwmMap` plus current `equipment` rows. It has no React, Supabase-query, or Flex-write dependency. Every candidate retains:

- canonical identity and requested quantity;
- destination group;
- explicit or derived provenance;
- source arrays/power tables;
- resolved `equipment` row and `resource_id`;
- mapped, missing-resource, missing-equipment, or ambiguous state;
- safety warnings.

Aggregation is `flexCategoryKey + resource_id`. The same resource may therefore remain separate in mains and outfill, while left/right instances within one subsystem merge.

## Array classification

`parse-la-session` preserves the closest named Soundvision ancestor for every cluster, including groups nested multiple levels below a broad `ALL` physical configuration. Classification is case-insensitive and conservative: the explicit Soundvision group is authoritative, followed by an explicit array-name category, known subwoofer/full-range models, and safe sided-model fallbacks. The common phrase `Copy of …` is not interpreted as the abbreviation `OF`. It recognizes mains, downfill, outfill/sidefill, subwoofers, frontfill, and delays. Unknown arrays are displayed under “Arrays sin clasificar” and cannot be pushed. Mixed subwoofer/full-range arrays receive a warning. Preview source labels show both group and array so the classification input remains inspectable.

Group order is deterministic:

1. `pa_mains`
2. `pa_downfill`
3. `pa_outfill`
4. `pa_subs`
5. `pa_frontfill`
6. `pa_delays`
7. `pa_amp`

The group resource IDs remain owned by `FLEX_CATEGORY_MAP` in `src/services/flexPullsheets.ts`.

## Shared technical derivation

Rigging aliases and serialized bumper-piece quantities are owned by `xmlpRiggingRequirements.ts`. Both Pesos and Flex consume `resolveXmlpRiggingRequirement`; `2x K2-BAR`, for example, produces two BUMPER K2 requirements in both paths. Before Flex resolution, bumper pieces are aggregated per destination group and converted to the real physical cases:

- K1: one dual case per pair, plus one single case for an odd remainder;
- K2 and KARA: one dual case per two bumpers, rounded up for an odd remainder;
- K3, KIVA, KS28, and supported TFS bumpers remain individual resources.

Motor selection remains inside `buildXmlpWeightTables`:

- flown arrays only;
- existing pickup-point interpretation;
- 120% required-capacity rule;
- no fallback to an undersized motor;
- structured requirements returned alongside Pesos tables.

PDU selection remains inside the Consumos path. `buildCalculatedXmlpPowerRequirements` uses the Sound component catalog, 20% safety margin, 0.95 power factor, three-phase 400 V settings, existing PDU options, and the 80% planning-load recommendation. Flex consumes only its structured PDU result; XMLP amplifier units remain the only source of amplifier equipment lines.

Compatible LA4/LA4X/LA8/LA12X units share one container-only packaging calculation:

```ts
laRackQuantity = Math.floor(compatibleAmplifierCount / 3)
laCaseQuantity = compatibleAmplifierCount % 3
```

The compatible individual amplifier lines are not also exported, preventing double counting. PLM and other non-compatible units remain individual lines and do not contribute to LA-RAK II/LA-CASE packaging. Thus 20 LA12X becomes exactly 6 LA-RAK II plus 2 LA-CASE.

## Equipment resolution

The database source of truth is `public.equipment.resource_id`. The planner uses exact normalized aliases plus approved departments/categories; it never uses unrestricted substring matching. A resource ID assigned to different canonical identities is treated as ambiguous even when both rows are otherwise valid.

The mapping migration adds the explicitly approved audit resources for K1-SB, rigging packages, LA-CASE II, sound PDUs, and the chosen 2T D8+ motor. K1 dual/single cases are selected deterministically from the bumper count, so their two approved resources are not an ambiguity. Remaining known gaps/ambiguities are visible in preview:

- no approved IDs: LA4, LA4X, LA8, CEE16 sound PDU, and supported TFS speakers/rigging;
- KS28 and BUMPER KS28: the migration corrects the legacy speaker/BUMP collision first, assigning the real KS28 speaker resource (`acbd4200-4fa3-11eb-815f-2a0a4490a7fb`) to the speaker and the former ID to `KS28 BUMP`; guarded assertions abort the migration if either ID belongs to unrelated equipment;
- unknown XMLP models and arrays remain disabled rather than defaulting to mains.

## Destination discovery and writes

Job discovery includes only:

- `pull_sheet` → Pull Sheet;
- `comercial_presupuesto` → Presupuesto;
- `dryhire_presupuesto` → Presupuesto.

The `presupuestos_recibidos` container and unrelated financial documents are excluded. A pasted `#equipment-list` or `#fin-doc` URL identifies its type; generic URLs require the operator to select Pull Sheet or Presupuesto explicitly.

If the job has no usable destination, “Crear documento Flex” delegates to the job card's existing create/add-folder selector instead of inventing a second folder-creation path. After that flow finishes, “Actualizar documentos” re-runs job-scoped discovery and auto-selects the new document when it is the only result.

Transports are:

- Pull Sheet: `/line-item/{document}/add-resource/{resource}`;
- Presupuesto: `/financial-document-line-item/{document}/add-resource/{resource}`.

For each selected non-empty group, the strict writer creates its header and captures the returned line-item ID before adding children with `parentLineItemId`. If the header fails, every child in that group is skipped and reported; children never fall back to the root. Other groups continue independently.

## Duplicate behavior and security

There is no reliable generic reader for existing Flex resource quantities and parent nesting. The operation is therefore additive and requires explicit confirmation. It does not reduce, delete, move, or claim to reconcile existing lines.

All Flex requests continue through `flexApiFetch` and the authenticated `secure-flex-api` Edge Function. No Flex credential or new secret is exposed to browser code. The parser entitlement and existing server-side Flex authorization remain unchanged.

## Deployment and rollback

The migration must be reviewed and applied by a human with the normal production `supabase db push --linked --dry-run` and migration workflow. Changes to nested Soundvision group extraction require redeploying `parse-la-session`; no other Edge Function changes are involved.

Application rollback: revert the feature PR. This removes the preview and writer without affecting previously created Flex lines; any already-added Flex lines require manual Flex cleanup.

Mapping rollback, if the migration was applied: delete only the exact `equipment` rows introduced by `20260720230000_add_xmlp_flex_equipment_resources.sql`, matching both name and `resource_id`. The migration also corrects a pre-existing KS28 speaker row; reversing that correction requires deleting the exact `KS28 BUMP` row first and restoring the speaker's former ID in a reviewed forward migration. Do not delete pre-existing equipment rows. Applied Supabase migrations are not rolled back by rewriting migration history.
