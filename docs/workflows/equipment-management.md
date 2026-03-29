# Equipment Management

> Inventory tracking with stock movements, sub-rental requests, equipment presets, and Flex integration.

## Overview

Equipment management tracks the company's inventory of technical equipment (PA systems, consoles, lighting fixtures, etc.) with stock levels, movement audit trails, sub-rental workflows, and reusable equipment presets.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/EquipmentManagement.tsx` |
| **Sub-rental** | `src/components/equipment/SubRentalManager.tsx` |
| **Stock movement** | `src/components/equipment/StockMovementDialog.tsx`, `StockMovementHistory.tsx` |
| **Inventory** | `src/components/equipment/InventoryManagementDialog.tsx`, `StockManagement.tsx` |
| **Presets** | `src/components/equipment/PresetEditor.tsx`, `PresetCreationManager.tsx`, `JobPresetManager.tsx` |
| **Creation** | `src/components/equipment/EquipmentCreationManager.tsx` |
| **Hooks** | `src/hooks/useEquipmentModels.ts`, `useEquipmentValidation.ts` |

## Database Tables

| Table | Purpose |
|-------|---------|
| `equipment` | Master catalog (name, category, department, description, specs) |
| `global_stock_entries` | Current inventory levels per equipment (base_quantity) |
| `stock_movements` | Immutable audit trail (equipment_id, quantity, movement_type, user_id, notes) |
| `sub_rentals` | External rental requests (batch_id, equipment_id, quantity, dates, job_id) |
| `equipment_presets` | Saved equipment bundles (name, department, is_template) |
| `preset_items` | Items in a preset (preset_id, equipment_id, quantity, subsystem) |

## Equipment Categories

### Lights Department
convencional, robotica, fx, rigging, controles, cuadros, led, strobo, canones, estructuras

### Sound Department
PA Systems: pa_mains, pa_outfill, pa_subs, pa_frontfill, pa_delays, pa_amp
Consoles: foh_console, mon_console
Wireless/IEM: wireless, iem
Microphones: wired_mics

## Workflows

### Stock Movement

```
1. SELECT equipment from catalog
2. CHOOSE movement type (addition or subtraction)
3. ENTER quantity and notes
4. VALIDATE (subtractions blocked if would go negative)
5. INSERT to stock_movements (immutable audit log)
6. UPDATE global_stock_entries.base_quantity
```

### Sub-Rental Request

```
1. SET date range (start + end)
2. ADD line items: [{equipment_id, quantity}, ...]
3. ADD notes (vendor name, special requests)
4. OPTIONAL: link to job, mark as stock extension
5. SUBMIT → generates batch_id, inserts all items
6. OPTIONAL: auto-create transport request (edge function)
7. TRACK → group by batch_id for request-level view
8. DELETE when no longer needed
```

### Equipment Presets

```
1. CREATE preset → name, department
2. ADD items → equipment_id + quantity + subsystem
3. SAVE as template (reusable) or job-specific
4. APPLY to job → assigns preset quantities
5. PUSH TO FLEX → via PushPresetToFlexDialog
```

## Integration Points

- **Job System**: Sub-rentals linked to jobs via job_id
- **Transport System**: Auto-creates transport requests for sub-rentals
- **Flex Integration**: Push presets to Flex via edge function
- **Festival Gear Setup**: Festival gear requirements reference equipment catalog
