# Native Sound Truck Planner integration

Status: first implementation slice in PR #952.

## Milestone 1 scope

Sound only.

The native workflow is:

1. Discover/select the Sound Pull Sheet for a job.
2. Read the Pull Sheet's normal Flex `equipment-list` data producer.
3. Aggregate physical material models.
4. Normalize source equipment into loaded transport units.
5. Show unresolved transport metadata before packing.
6. Feed normalized transport profiles into the Truck Planner core.
7. Try vehicles smallest to largest until the whole load is valid.
8. Open the result in the interactive workspace for manual correction.
9. Save/version/publish the job plan.
10. Produce the transport request and native reports.

Lights, combined Sound+Lights planning, and Jasper replacement are deliberately later milestones.

## Data ownership

### Flex Pull Sheet

Flex owns what material the job requires.

The Pull Sheet does **not** contain speaker carts/cases.  A K2 line therefore means
equipment demand, not a physical loose K2 cabinet in the truck.

### Sound normalization rules

`truck_planner_sound_transport_rules` maps an exact Flex source identity to a
loaded transport profile and pack quantity.

Identity precedence:

1. exact source barcode;
2. exact normalized source name;
3. unresolved.

There is no substring/fuzzy fallback. A missing rule must remain visible.

Quantities are aggregated before rounding. For example, two PS lines containing
12 K2 each are summed to 24 before applying `ceil(24 / 4) = 6` carts.

### Loaded transport profiles

`truck_planner_case_skus` is the canonical physical object seen by the packer.

Profiles describe the **loaded transport envelope**, not bare transport hardware.
This distinction is critical for carts/chariots.

Example:

`24 x K2 -> 6 x L-Acoustics K2 (4) w/ Chariot`

The K2 profile currently uses the externally published loaded dimensions
353 x 1339 x 1514 mm and 246.2 kg, with source provenance stored alongside the
profile.

Sector-Pro measured overrides should ultimately take precedence over external
reference data when we know our real transport differs.

## Vertical-column keepout

Some speaker chariots have a normal finite physical height but nothing may be
loaded above them.

Do **not** fake this by making the transport object truck-height.

The physical profile retains the real loaded height for:

- door clearance;
- volume/visualisation;
- collision geometry;
- weight and centre-of-mass calculations.

A separate `blocks_vertical_column` constraint reserves the profile's XY
footprint from the top of the physical object to the vehicle ceiling.

The matching Truck Planner core work is tracked in
`jvhtec/truck-load-planner#26`.

## First seeded rule

Sector-Pro Flex K2 inventory:

- source barcode: `00160`
- source name fallback: `K2`
- pack quantity: 4
- profile: `lacoustics:k2:4:chariot`
- physical loaded envelope: 353 x 1339 x 1514 mm
- loaded weight: 246.2 kg
- floor only: yes
- top load: no
- vertical column blocked: yes

External reference:
https://www.truckpacker.com/manufacturer-library/cases/l-acoustics

Only a curated/verified subset should be copied into the Sector-Pro catalogue.
Keep source URL/external key and verification date on imported profiles.

## Implemented seam

`importSoundPullsheetForTruckPlanner(pullsheetElementId)` currently returns:

- normalized transport units;
- source quantities and pack ratios;
- spare capacity in partially filled final units;
- source lines used for every transport profile;
- unresolved Pull Sheet lines.

That object is intentionally pre-packing.

## Next coding slice

1. Add a job-card Sound Truck Planner entry point.
2. Discover the Sound Pull Sheet using the existing Flex folder service.
3. Run `importSoundPullsheetForTruckPlanner`.
4. Present a review screen:
   - generated transport units;
   - loaded dimensions;
   - provenance;
   - unresolved models.
5. Block packing/publishing while unresolved physical transport lines remain.
6. Adapt the reusable Truck Planner core into Area Tecnica.
7. Convert each normalized profile directly into `CaseSKU` + quantity.
8. Add smallest-fitting-vehicle selection using the actual AutoPack engine.
9. Persist the source Pull Sheet element id/hash with the plan version so stale
   plans can be detected after the PS changes.

## Reporting direction

Jasper v16 remains a temporary fallback/debug report.

Once the native planner can reproduce known jobs reliably, reports should be
generated from published Area Tecnica plan data:

- selected vehicle and metrics;
- top/side load diagrams;
- case/cart list;
- load order;
- source Pull Sheet revision;
- unresolved/warning state;
- warehouse/technician views.

At that point Jasper is no longer part of the planning path.
