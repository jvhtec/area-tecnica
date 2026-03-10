# Logistics Transport Provider & Notes Feature Design

**Date:** 2025-11-25
**Status:** Design Complete - Ready for Implementation

## Overview

Add two missing fields to the logistics system:
1. **Transport Provider** - Track which company/method is handling the transport
2. **Notes** - Additional information and instructions for logistics events

These fields will be added to the form, displayed in all card variants, and integrated into the wallboard displays.

---

## 1. Database Schema Changes

### New Enum Type: transport_provider_enum

Create a new PostgreSQL enum type with the following values:

```sql
CREATE TYPE transport_provider_enum AS ENUM (
  'camionaje',
  'transluminaria',
  'the_wild_tour',
  'pantoja',
  'crespo',
  'montabi_dorado',
  'grupo_sese',
  'nacex',
  'sector_pro',
  'recogida_cliente'
);
```

### Table Modification: logistics_events

Add new column to existing table:

```sql
ALTER TABLE logistics_events
ADD COLUMN transport_provider transport_provider_enum;
```

**Notes:**
- Column is nullable (existing records won't have values)
- Transport provider is often added after initial event creation
- The `notes` field already exists in the schema (text, nullable) - no changes needed

### TypeScript Type Updates

Update `src/integrations/supabase/types.ts`:
- Auto-generated types will include new enum
- `Database['public']['Enums']['transport_provider_enum']`
- `logistics_events` table type will include `transport_provider` field

---

## 2. Constants & Configuration

### New File: src/constants/transportProviders.ts

Create constants file mapping providers to display labels and icons:

```typescript
export type TransportProvider =
  | 'camionaje'
  | 'transluminaria'
  | 'the_wild_tour'
  | 'pantoja'
  | 'crespo'
  | 'montabi_dorado'
  | 'grupo_sese'
  | 'nacex'
  | 'sector_pro'
  | 'recogida_cliente';

export const TRANSPORT_PROVIDERS: Record<TransportProvider, {
  label: string;
  icon: string | null;
}> = {
  camionaje: {
    label: 'Camionaje',
    icon: '/icons/transport-providers/camionaje.svg'
  },
  transluminaria: {
    label: 'Transluminaria',
    icon: '/icons/transport-providers/transluminaria.svg'
  },
  the_wild_tour: {
    label: 'The Wild Tour',
    icon: '/icons/transport-providers/the-wild-tour.svg'
  },
  pantoja: {
    label: 'Pantoja',
    icon: '/icons/transport-providers/pantoja.svg'
  },
  crespo: {
    label: 'Crespo',
    icon: '/icons/transport-providers/crespo.svg'
  },
  montabi_dorado: {
    label: 'Montabi-Dorado',
    icon: null // No icon available
  },
  grupo_sese: {
    label: 'Grupo Sesé',
    icon: '/icons/transport-providers/grupo-sese.svg'
  },
  nacex: {
    label: 'Nacex',
    icon: '/icons/transport-providers/nacex.svg'
  },
  sector_pro: {
    label: 'Sector-Pro',
    icon: '/icons/transport-providers/sector-pro.svg'
  },
  recogida_cliente: {
    label: 'Recogida Cliente',
    icon: null // Generic option, no icon
  }
};
```

### Icon Assets

**Storage Location:** `/public/icons/transport-providers/`

**Icon Files Needed:**
- `camionaje.svg`
- `transluminaria.svg`
- `the-wild-tour.svg`
- `pantoja.svg`
- `crespo.svg`
- `grupo-sese.svg`
- `nacex.svg`
- `sector-pro.svg`

**Format:** SVG (scalable, theme-friendly)
**Fallback:** If icon is null or fails to load, show text only

---

## 3. Form Updates (LogisticsEventDialog)

### Component: src/components/logistics/LogisticsEventDialog.tsx

Add two new form fields:

#### Transport Provider Field

**Position:** After "License Plate" field (groups all transport-related fields)

**Implementation:**
```tsx
<FormField
  control={form.control}
  name="transport_provider"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Transport Provider</FormLabel>
      <Select onValueChange={field.onChange} value={field.value || ""}>
        <SelectTrigger>
          <SelectValue placeholder="Select provider..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(TRANSPORT_PROVIDERS).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormItem>
  )}
/>
```

**Properties:**
- Optional field (nullable)
- Text-only dropdown (no icons in form)
- Often added after initial event creation

#### Notes Field

**Position:** Bottom of form, after "Also Create Unload" checkbox

**Implementation:**
```tsx
<FormField
  control={form.control}
  name="notes"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Notes</FormLabel>
      <Textarea
        placeholder="Additional notes or instructions..."
        maxLength={500}
        {...field}
        value={field.value || ""}
      />
    </FormItem>
  )}
/>
```

**Properties:**
- Multi-line textarea
- Max length: 500 characters
- Optional field (nullable)
- Placeholder text for guidance

### Form State Updates

**Add to form schema:**
```typescript
transport_provider: z.string().nullable().optional(),
notes: z.string().max(500).nullable().optional()
```

**Include in mutation payloads:**
- Create event mutation
- Update event mutation
- Both fields pass through to database

**Form Flow:**
Event Type → Date/Time → Transport Type → License Plate → **Transport Provider** → Departments → Loading Bay → Job/Title → Color → Auto-create Unload → **Notes**

---

## 4. Card Display Updates

### Component: src/components/logistics/LogisticsEventCard.tsx

Update card rendering to display new fields:

#### Transport Provider Display

**Position:** Same row as transport type badge, after it

**Rendering:**
```tsx
{event.transport_provider && (
  <Badge variant="outline" className="flex items-center gap-2">
    {TRANSPORT_PROVIDERS[event.transport_provider].icon && (
      <img
        src={TRANSPORT_PROVIDERS[event.transport_provider].icon}
        alt=""
        className="w-6 h-6"
      />
    )}
    {TRANSPORT_PROVIDERS[event.transport_provider].label}
  </Badge>
)}
```

**Styling:**
- Badge with outline variant (distinct from transport type)
- Icon size: 24x24px (w-6 h-6)
- Horizontal layout: icon + text with gap-2
- Only render if provider is set

#### Notes Display

**Position:** Bottom of card, after all other information

**Rendering:**
```tsx
{event.notes && (
  <div className="text-sm text-muted-foreground flex items-start gap-1 mt-2">
    <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
    <span className="line-clamp-2">
      {event.notes}
    </span>
  </div>
)}
```

**Styling:**
- Smaller text (text-sm)
- Muted color (gray)
- Truncate to 2 lines with ellipsis (`line-clamp-2`)
- Small note icon for visual clarity
- Only render if notes exist

#### Card Layout Example

```
┌─────────────────────────────────────────┐
│ [CARGA]                       10:00     │
│ [🚛 Trailer] [🚚 Camionaje]             │
│ Festival XYZ - Load                     │
│ ABC-1234  │  Muelle 3                   │
│ [Sound] [Lights]                        │
│ 📝 Equipment needs careful handling...  │
└─────────────────────────────────────────┘
```

### Responsive Behavior

- **Desktop:** Full width, all badges horizontal
- **Mobile/Compact:** Stack badges vertically if needed
- **Wallboard:** Same layout, adapted to active theme

---

## 5. Wallboard Updates

### Component: src/pages/Wallboard.tsx - LogisticsPanel

Update wallboard logistics display (lines 2137-2196):

**Current Format:**
```
[Date] [Time]
[Day Name]
[Vehicle Icon] [Title]
[Event Type Badge] [Transport Type] [Bay] [Plate]
[Departments]
```

**Updated Format:**
```
[Date] [Time]
[Day Name]
[Vehicle Icon] [Title]
[Event Type Badge] [Transport Type] [Provider Icon+Text] [Bay] [Plate]
[Departments]
[Notes (if present)]
```

**Provider Display:**
```tsx
{item.transport_provider && (
  <div className="flex items-center gap-2">
    {TRANSPORT_PROVIDERS[item.transport_provider].icon && (
      <img
        src={TRANSPORT_PROVIDERS[item.transport_provider].icon}
        alt=""
        className="w-8 h-8"
      />
    )}
    <span>{TRANSPORT_PROVIDERS[item.transport_provider].label}</span>
  </div>
)}
```

**Notes Display:**
```tsx
{item.notes && (
  <div className="text-sm opacity-80 line-clamp-1 mt-1">
    {item.notes}
  </div>
)}
```

**Sizing:**
- Provider icons: 32x32px (w-8 h-8) for better visibility on wallboards
- Notes: Single line with truncation
- Maintains 6 items per page pagination

### Wallboard API Updates

**File:** `supabase/functions/wallboard-feed/index.ts`

Update `/logistics` endpoint to include new fields:

```typescript
interface LogisticsItem {
  id: string;
  date: string;
  time: string;
  title: string;
  transport_type: string | null;
  transport_provider: string | null; // NEW
  plate: string | null;
  job_title?: string | null;
  procedure: string | null;
  loadingBay: string | null;
  departments: string[];
  color?: string | null;
  notes?: string | null; // NEW
}
```

**Query Update:**
```typescript
const { data: events, error } = await supabase
  .from('logistics_events')
  .select(`
    id,
    event_date,
    event_time,
    event_type,
    transport_type,
    transport_provider,
    license_plate,
    loading_bay,
    color,
    notes,
    title,
    jobs!logistics_events_job_id_fkey (
      title
    )
  `)
  .gte('event_date', startDate)
  .lte('event_date', endDate)
  .order('event_date', { ascending: true })
  .order('event_time', { ascending: true });
```

**Map to LogisticsItem:**
```typescript
transport_provider: event.transport_provider,
notes: event.notes
```

---

## 6. Implementation Checklist

### Database
- [ ] Create `transport_provider_enum` type
- [ ] Add `transport_provider` column to `logistics_events` table
- [ ] Run migration
- [ ] Regenerate TypeScript types

### Constants & Assets
- [ ] Create `src/constants/transportProviders.ts`
- [ ] Create `/public/icons/transport-providers/` directory
- [ ] Add provider icon SVG files (8 icons)

### Form Updates
- [ ] Import `TRANSPORT_PROVIDERS` constant
- [ ] Add transport provider select field
- [ ] Add notes textarea field
- [ ] Update form schema validation
- [ ] Update create/update mutations

### Card Display
- [ ] Update `LogisticsEventCard` component
- [ ] Add provider badge with icon
- [ ] Add notes display with truncation
- [ ] Test responsive layout

### Wallboard
- [ ] Update `LogisticsPanel` in `Wallboard.tsx`
- [ ] Add provider display with icon
- [ ] Add notes display (1 line truncation)
- [ ] Update `wallboard-feed/index.ts` endpoint
- [ ] Add fields to LogisticsItem interface
- [ ] Update database query
- [ ] Test pagination still works (6 items/page)

### Testing
- [ ] Create event with provider and notes
- [ ] Verify display in logistics page cards
- [ ] Verify display in today's schedule
- [ ] Verify display in wallboard
- [ ] Test with/without icons
- [ ] Test long notes truncation
- [ ] Test null/empty values
- [ ] Test existing events still render

---

## 7. Edge Cases & Considerations

**Existing Events:**
- Events created before migration will have null provider/notes
- Cards should gracefully handle missing values (only show if present)

**Icon Loading:**
- Use fallback if icon fails to load (show text only)
- Icons are optional (some providers may not have icons)

**Text Truncation:**
- Cards: 2 lines for notes (`line-clamp-2`)
- Wallboard: 1 line for notes (`line-clamp-1`)
- Full text visible in edit dialog

**Performance:**
- Icon files should be optimized SVGs (< 10KB each)
- No impact on query performance (indexed fields not required)

**Localization:**
- Provider labels in Spanish could be added later
- Currently using company names (mostly proper nouns)

---

## Success Criteria

✅ Transport provider can be selected in form
✅ Notes can be entered in form (max 500 chars)
✅ Provider displays in cards with icon
✅ Notes display in cards with truncation
✅ Both fields visible in wallboard
✅ Existing events still render correctly
✅ Icon fallback works when icon missing
✅ No visual clutter in compact card view

---

## Implementation Completed

**Date:** 2025-11-25
**Branch:** feature/logistics-provider-notes

**Changes:**
- ✅ Database enum and column added
- ✅ Form fields implemented (provider + notes)
- ✅ Card display updated with badges and notes
- ✅ Wallboard panel updated
- ✅ API endpoint updated
- ✅ Types regenerated and updated

**Testing:**
- ✅ Manual testing completed
- ✅ Edge cases verified
- ✅ Icon fallback working

**Next Steps:**
- Replace placeholder icons with actual brand logos
- Deploy migration to production
- Monitor for issues
