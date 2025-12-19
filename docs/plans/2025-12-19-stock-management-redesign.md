# Stock Management UI Redesign

## Overview

Redesign the stock management interface from a modal-heavy, multi-section layout to a streamlined inline-editing configuration interface.

## Problem Statement

Current issues:
- Too much scrolling with no search/filter to find items
- Modal dialogs for every quantity change (overkill for simple edits)
- Confusing split between "Gestionar Equipamiento" and "Gestionar Stock" sections
- Unclear distinction between `base_quantity` and `currentQuantity`

## Use Cases

Primary purposes (configuration, not daily tracking):
- Add new equipment items
- Set base quantities ("we own X of these")
- Edit equipment details (name, category)
- Delete equipment no longer relevant

Daily tracking happens via presets and external systems (Flex).

## Design

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│  Gestionar Inventario                          [X]  │
├─────────────────────────────────────────────────────┤
│  [🔍 Search equipment...]                           │
│                                                     │
│  [+ Add Equipment]  (expandable form, collapsed)    │
│                                                     │
│  ▼ Robótica (6 items)                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ Moving Head Wash    [Edit] [🗑]    Qty: [24]│   │
│  │ Moving Head Spot    [Edit] [🗑]    Qty: [12]│   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ▶ Convencional (8 items)  (collapsed)              │
│                                                     │
│  ▶ LED (10 items)  (collapsed)                      │
└─────────────────────────────────────────────────────┘
```

### Key Components

1. **Search bar** - Filters items by name across all categories
2. **Add Equipment form** - Expandable inline form (name, category dropdown, quantity)
3. **Category groups** - Collapsible accordion sections (department subcategories only)
4. **Equipment rows** - Name, Edit/Delete buttons, inline quantity input

### Interactions

| Action | Behavior |
|--------|----------|
| **Add equipment** | Click "+ Add Equipment" → form expands inline → fill fields → Save |
| **Edit equipment** | Click "Edit" → row expands to inline form → Save/Cancel |
| **Delete equipment** | Click trash → inline tooltip confirmation → confirm |
| **Change quantity** | Click number → type new value → auto-saves on blur/Enter |
| **Search** | Type to filter → categories with no matches hide |

### What's Removed

- Modal dialogs for +/- stock movements
- Separate "Gestionar Equipamiento" section
- "Guardar Inventario" button (auto-save instead)
- `base_quantity` vs `currentQuantity` distinction (show one quantity)
- StockMovementDialog component (no longer needed for this UI)

## Technical Notes

- Scoped by user department (existing behavior, keep as-is)
- Categories are department subcategories (robótica, convencional, etc.)
- Auto-save uses debounced mutations to avoid excessive API calls
- Optimistic updates for responsive feel

## Files to Modify

- `src/components/disponibilidad/StockCreationManager.tsx` - Complete rewrite
- `src/components/equipment/InventoryManagementDialog.tsx` - Simplify wrapper
- `src/components/equipment/EquipmentCreationManager.tsx` - May integrate or remove
