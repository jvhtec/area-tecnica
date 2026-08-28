# Estructura motor preparation

## Ownership

Estructura is the warehouse/Flex operational owner of motors, motor controllers, and associated motor/control cabling. General rigging remains owned by the originating technical department: Sound keeps its bumpers, frames, and rigging hardware, and Lights keeps its corresponding rigging material.

Estructura is not a selectable job department and has no `job_departments` dependency. Standard job and tour-date folder reconciliation always creates one Estructura parent and exactly two tracked Pull Sheets:

| Destination | Tracking discriminator | Responsible |
|---|---|---|
| Estructura Sonido | `source_department = 'sound'` | Sound responsible person |
| Estructura Luces | `source_department = 'lights'` | Lights responsible person |

Both rows retain `department = 'estructura'` and `folder_type = 'pull_sheet'`. Target resolution uses these fields, not names or a user-selected URL.

## Operator workflow

`Preparar motores` is available in desktop and mobile Project Management job-card actions to management users for non-dry-hire jobs.

1. Open `Motores` / `Preparar motores`.
2. If the job predates Estructura tracking, choose `Crear Estructura y Pull Sheets` inside the dialog.
3. On an Estructura Sound or Lights job card, enter inventory-model quantities for that department using the numeric inputs or step buttons. Sound cards target only Estructura Sonido; Lights cards target only Estructura Luces. The action is not available on Production cards.
4. Review the department total.
5. Read the additive warning and choose `Añadir N unidades`.
6. Review the result for the current department.

The preparation catalog contains the approved serialized motor allowlist plus the approved motor-controller model IDs. Automatic certificate eligibility continues to use only the serialized motor allowlist, so controllers never appear in the certificate selector. The dialog requests inventory-model quantities only; warehouse staff assign serialized units later in Flex.

The dialog is mobile-ready: it uses the dynamic viewport and safe-area inset, confines scrolling to the model list, stacks footer actions on narrow screens, and keeps quantity/recovery controls at a minimum 44 px touch target.

## Additive semantics

Flex writes are additive. The operation does not read, reduce, delete, move, or reconcile existing quantities. Repeating a request can create duplicates. Zero-quantity models are filtered before writing and Sound/Lights selections are never crossed.

## XMLP and legacy behavior

No XMLP data is required. Existing Pesos/XMLP motor requirements, when the import is linked to a job, are routed directly to Estructura Sonido by the XMLP package workflow; rigging hardware remains in Sound. XMLP parse results are ephemeral and are not persisted as defaults for a later job-card dialog, avoiding stale hidden quantities.

Legacy jobs without tracked Estructura sheets repair themselves from the motor dialog. The recovery action loads the job and reuses its tracked Flex hierarchy; for a tour date it first reconciles the tour-level Estructura root, then creates/reuses the date's Estructura folder and both source Pull Sheets. It refreshes the destinations in place without opening the generic folder picker. Automatic motor-certificate discovery reports unavailable until the two Estructura sheets and outbound manifests exist; the existing manual serialized-unit certificate selector remains available for exceptions.

## Deliberately deferred inventory

The reviewed motor-controller rows are exposed as explicit inventory models. Cabling remains deferred because the repository does not contain a reviewed set of cable `equipment.resource_id` mappings or a documented quantity rule. No ratios are inferred. The shared Estructura equipment push model can accept additional inventory rows once those identifiers and business rules are approved.

Dry hire retains its existing department-specific commercial folder/Presupuesto hierarchy. The standard Estructura hierarchy and motor-preparation action are not forced into that special workflow.
