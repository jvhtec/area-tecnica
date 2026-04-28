# Festival Gear Setup & Comparison Architecture

This document explains how the festival system models equipment capacity and compares artist requirements against configured inventory.

## 1) Data model

### `festival_gear_setups` (global setup)

Per-job global equipment capability:

- Console inventories: `foh_consoles`, `mon_consoles`.
- RF/IEM/mics inventories: `wireless_systems`, `iem_systems`, `wired_mics`.
- Stage-wide capacities: monitors, infrastructure runs (`cat6`, `hma`, `coax`, `opticalcon_duo`, `analog`).
- Extras: side fills, drum fills, DJ booths.
- Planning metadata: `max_stages`, notes/outboard fields.

### `festival_stage_gear_setups` (stage override setup)

Per-stage override configuration linked by `gear_setup_id` and `stage_number`.

This allows stage-specific capacity where global setup is not enough.

## 2) Main UI modules

- Festival setup UI:
  - `src/components/festival/FestivalGearSetupForm.tsx`
  - `src/components/festival/gear-setup/ConsoleConfig.tsx`
  - `src/components/festival/gear-setup/WirelessConfig.tsx`
  - `src/components/festival/gear-setup/WiredMicConfig.tsx`
  - `src/components/festival/gear-setup/InfrastructureConfig.tsx`
  - `src/components/festival/gear-setup/StageEquipmentConfig.tsx`
- Analysis UI:
  - `src/components/festival/GearMismatchIndicator.tsx`
  - `src/components/festival/gear-setup/MicrophoneNeedsCalculator.tsx`
  - `src/components/festival/gear-setup/MicrophoneAnalysisPreview.tsx`

## 3) Comparison engine

Core service: `src/utils/gearComparisonService.ts`.

### What the comparison engine returns

- Per-artist mismatch list (`error`, `warning`, `info`).
- Category-level mismatch typing (console, wireless, iem, microphones, infrastructure, extras, monitors).
- Aggregated additional equipment needs by model and subsystem.

### Stage resolution behavior

- Stage 1 may use global setup when stage override is absent.
- Other stages rely on explicit stage setup; missing stage setup is treated as empty inventory.

This design keeps capacity assumptions explicit and conservative for multi-stage festivals.

## 4) Workflow

```text
Set global setup
  → (Optional) define per-stage overrides
    → Compare every artist requirement against effective stage setup
      → Surface mismatches and shortages
        → Update setup or rider assumptions
          → Export validated tables/PDFs
```

## 5) Design considerations

- Keep global inventory simple and reusable.
- Use stage overrides only for actual divergence.
- Treat comparison warnings as planning signals (not always blockers).
- Track provider mode (`festival`/`band`/`mixed`) to avoid false conflict reporting.

## 6) Output consumers

- Artist table status indicators.
- Gear planning dashboards.
- Pullsheet push-to-Flex flow.
- Printable technical documentation.
