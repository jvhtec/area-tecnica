# Consumos power calculations

This document is the source of truth for the Sound, Lights, and Video
Consumos calculators and their generated power reports.

## Scope and units

The calculator is a planning aid for connected event loads. It reports:

- real power, `P`, in watts (W);
- reactive power, `Q`, in volt-amperes reactive (var);
- apparent power, `S`, in volt-amperes (VA);
- line current, `I`, in amperes (A).

The default Spanish/European supplies are 230 V single-phase and 400 V
three-phase line-to-line, consistent with IEC 60038 nominal low-voltage
systems. The voltage remains editable because the actual supply must be
confirmed on site. See [IEC 60038](https://webstore.iec.ch/en/publication/153).

## Canonical equations

For each row:

```text
P_row = quantity × watts_per_unit
P_total = Σ P_row
k = 1 + safety_margin_percent / 100
P_adjusted = k × P_total
```

For Sound and Video, one global power factor `PF` applies to the table:

```text
Q_adjusted = P_adjusted × tan(acos(PF))
S_adjusted = sqrt(P_adjusted² + Q_adjusted²) = P_adjusted / PF
```

Lights supports a PF per row. Loads are combined as P/Q vectors before the
same planning margin is applied:

```text
Q_row = P_row × tan(acos(PF_row))
P_adjusted = k × Σ P_row
Q_adjusted = k × Σ Q_row
S_adjusted = sqrt(P_adjusted² + Q_adjusted²)
```

This is intentionally not `Σ(P_row / PF_row)`: apparent-power magnitudes are
not scalar-added when the corresponding P/Q components are available. The
P/Q/S relationship follows the standard power triangle described in
[Schneider Electric's power measurements documentation](https://productinfo.se.com/pm3200/viewer?docidentity=PowerPQS-CE56FE4F&extension=xml&lang=en&manualidentity=UserManualSeriesDOCA0006EN-07-36546E48).

Current is calculated from adjusted apparent power:

```text
single phase:        I = S_adjusted / V_LN
balanced 3 phase:   I_line = S_adjusted / (sqrt(3) × V_LL)
```

The single-phase voltage is line-to-neutral. The three-phase voltage is
line-to-line and the load is assumed balanced. These are the same standard
single/three-phase load relationships summarized by
[Schneider Electric](https://www.se.com/us/en/faqs/FA101600/).

## Input validation

A new calculation is rejected unless:

- at least one non-empty load row exists;
- quantity, watts, and voltage are finite and greater than zero;
- every PF is finite and in the interval `0 < PF <= 1`;
- safety margin is finite and from 0% through 100%.

Blank trailing rows are ignored. Negative, zero, `NaN`, and infinite values
never become a generated table or a PDU recommendation.

## PDU planning recommendation

PDU labels carry an ampere rating. A listed PDU is recommended only when:

```text
calculated line current <= 0.80 × PDU ampere rating
```

The 80% factor is an Area Tecnica planning policy, not a claim about a
universal IEC continuous-load rule. Reports disclose both the rating and the
80% planning limit. If no listed option passes, the result is **over
capacity** and no undersized PDU is presented as a recommendation. A custom
label without a parseable ampere rating is **unverified**, not safe.

This recommendation does not select breakers, cable cross-section, RCD type,
or connector/protection coordination.

## Stored calculation snapshot

Every newly generated table stores calculation snapshot version 2 alongside
the legacy database columns. It contains raw and adjusted W, VA, current,
margin, phase mode, voltage, PF/PF source, and whether
the result is an estimate. The snapshot is stored inside existing JSON
payloads, so no database migration is required.

Editing restores the saved electrical settings. Reports use the saved
snapshot rather than the calculator's current controls. A malformed snapshot
is rejected and reconstructed through the legacy path.

Older records did not preserve all assumptions. They are reconstructed with
saved fields and department defaults and are visibly marked **legacy
estimate**. The legacy manual tour-default form stores watts and current
independently; its records therefore remain estimates.

## Report aggregation

Raw and adjusted watts can always be summed. System current and kVA are only
shown when the underlying electrical supplies can be combined soundly:

- one table is directly reportable;
- multiple balanced three-phase tables must use the same nominal
  line-to-line voltage, then the report calculates `ΣP`, `ΣQ`, resultant `S`,
  and line current;
- multiple single-phase tables are not aggregated until phase allocation is
  known;
- mixed phase modes, mixed voltages, or missing reproducible snapshots are
  reported as **not aggregable**.

Line currents are never scalar-added. “Not aggregable” is not the same as no
load; the report continues to show the raw and adjusted watt totals and the
reason aggregation was withheld.

## Loads excluded from totals

Hoist power and the FoH 16 A schuko requirement are auxiliary supply notes.
They are excluded from calculated totals because the current UI records only
the connector requirement, not a load in watts/PF/phase allocation. Reports
state this explicitly. Add those loads as ordinary rows if they must be part
of the calculated total.

## PDF electrical notation

Consumos PDFs embed a static Noto Sans instance derived from
the Noto Sans files already shipped with the application. This keeps `1φ`,
`3φ`, and `ΣP/ΣQ` searchable text and avoids jsPDF's incomplete built-in
Symbol-font mapping. If the font asset cannot be loaded, the exporter falls
back to explicit Spanish wording rather than emitting a corrupted glyph.

## Engineering limitations

The calculator assumes sinusoidal steady-state loads and a lagging PF. For
non-linear loads, one scalar PF may combine displacement and distortion and
may not describe neutral current or harmonic effects; see
[IEC TR 61000-1-7](https://webstore.iec.ch/en/publication/24199). The result
does not model diversity, inrush, duty cycle, phase imbalance, voltage drop,
harmonics, generator transient response, earthing, ambient derating, cable
bundling, selectivity, or fault current.

Final distribution design and protection must use manufacturer data, local
electrical rules, measured/confirmed supply conditions, and a qualified
electrical professional.

## Implementation and regression tests

- Canonical calculations and validation:
  `src/features/technical-tools/power/powerCalculations.ts`
- Snapshot parsing/legacy reconstruction:
  `src/features/technical-tools/power/powerSnapshots.ts`
- Compatible-system aggregation:
  `src/features/technical-tools/power/powerAggregation.ts`
- Tour/report normalization: `src/utils/tourPowerTables.ts`
- Tests: `src/features/technical-tools/power/__tests__/` and
  `src/utils/__tests__/tourPowerTables.test.ts`
