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
three-phase line-to-line at 50 Hz, the nominal low-voltage values of
UNE-EN 60038 (IEC 60038 / CENELEC HD 472 S1), which REBT ITC-BT-04 uses for
Spain. Those two numbers live in one place,
`src/features/technical-tools/power/electricalStandards.ts`, and every code
path that needs a default voltage reads them through `getVoltageForPhase`.
The voltage remains editable because the actual supply must be confirmed on
site. See [IEC 60038](https://webstore.iec.ch/en/publication/153).

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

## Persistence of a job's saved set

Saving from the calculator writes a whole **generation** of rows into
`power_requirement_tables` and then removes the rows it replaced. Two sweeps
run, and both are needed:

- a per-stage sweep that clears the older rows of every stage present in the
  new payload — it is scoped by stage so that saving one stage of a festival
  never deletes another stage's tables;
- a retirement pass over the specific row ids the save supersedes, computed by
  `resolveRetiredPowerRequirementIds` from what the editor loaded, what it is
  saving, and what it still holds for other stages.

The second pass exists because the first cannot see a row whose stage changed.
A table built with no stage selected and later saved under a stage — or removed
from the editor while a different stage was selected — is filed under a stage
the new payload never mentions, so the per-stage sweep skips it. The orphan then
keeps appearing in reports and, most visibly, gets listed a second time in the
Hoja de Ruta power summary. Rows belonging to tables the editor still holds but
is not saving right now are never retired.

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

## Spanish design rules checked on top of the calculation

The power triangle above gives the electrical result. Spanish practice adds
requirements the triangle does not carry, so each generated table is also run
through `evaluatePowerStandards`
(`src/features/technical-tools/power/electricalStandards.ts`). These checks
**never change a stored total, a current or a PDU recommendation** — they
produce advisory findings shown under the table in the calculator and as
notices in the power report.

### Discharge lighting — REBT ITC-BT-44 apdo. 3.1

A circuit feeding discharge lamps must be designed for a minimum load, in
volt-amperes, of **1,8 times the lamp power in watts**. That single factor
covers ballast losses, power factor and harmonic content together, so it is a
floor on the circuit rating rather than a claim about what the fixture draws.

For a table containing discharge rows the floor is

```text
S_min = k × (1.8 × ΣP_discharge + sqrt(ΣP_other² + ΣQ_other²))
```

where `k` is the same planning margin used everywhere else. Adding the
discharge floor to the vector sum of the remaining rows is the conservative
reading when both families share one circuit. A finding is raised only when
`S_min` exceeds the calculated `S_adjusted`. Because the floor is conservative
by construction it is reported as information, and escalates to a warning only
when `S_min` no longer fits the recommended PDU's planning limit — the one case
where it changes the connector to order.

Only rows typed `discharge` count. Sound and video tables carry no fixture
type, so the rule does not fire there; the catalogue's discharge entries are
fixture *input* power, which already includes the ballast, so `S_min` is a
deliberately conservative circuit floor rather than a corrected load figure.

### Neutral loading — UNE-HD 60364-5-52 Annex E / REBT ITC-BT-19

Past roughly a third of third-harmonic content, the neutral of a three-phase
circuit can carry more current than the lines and becomes the conductor that
sets the cable size. When more than 33% of a three-phase table's typed load is
non-linear (LED, discharge, hazers, consoles — anything fronted by a
rectifier), the table carries a warning that the figure reported is the line
current only. The calculator does not compute neutral current: doing that
needs measured or declared per-fixture harmonic spectra, which the catalogue
does not hold.

### Motor feeds — REBT ITC-BT-47 apdo. 3.1

Conductors feeding a single motor are sized for **125% of full-load current**.
Hoist supplies are recorded here as a connector requirement only and are
excluded from the totals, so the rule is surfaced as a reminder next to the
auxiliary-supply note rather than applied to anything.

### Deliberately not modelled

The 80% PDU planning factor below is company policy. IEC/UNE has no general
continuous-load derating of a protective device — the 80% continuous-load rule
is a North American one (NEC 210.20(A)) — so it is presented as a planning
limit and never as conformity. Diversity factors (REBT ITC-BT-10), voltage
drop limits (ITC-BT-19), temporary-installation rules for shows and stands
(ITC-BT-34), breaker curve selection against tungsten inrush (UNE-EN 60898),
RCD selection, earthing and fault-current coordination all stay out of scope.

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
- Nominal voltages and Spanish design-rule checks:
  `src/features/technical-tools/power/electricalStandards.ts`, applied to a
  table through `src/features/technical-tools/power/powerStandardsAssessment.ts`
- Snapshot parsing/legacy reconstruction:
  `src/features/technical-tools/power/powerSnapshots.ts`
- Compatible-system aggregation:
  `src/features/technical-tools/power/powerAggregation.ts`
- Tour/report normalization: `src/utils/tourPowerTables.ts`
- Job set persistence and row retirement:
  `src/features/technical-tools/power/powerPersistence.ts`
- Tests: `src/features/technical-tools/power/__tests__/` and
  `src/utils/__tests__/tourPowerTables.test.ts`
