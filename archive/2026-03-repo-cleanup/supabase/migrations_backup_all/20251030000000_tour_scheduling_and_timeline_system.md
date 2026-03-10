# Tour Scheduling and Timeline System Migration

**Migration File:** `20251030000000_tour_scheduling_and_timeline_system.sql`

## Overview

This migration adds comprehensive tour scheduling and timeline management capabilities to the Area Técnica platform. It extends existing tables and creates new tables to support detailed itinerary management, travel planning, accommodation tracking, and reusable schedule templates.

## What's Added

### 1. Extended `tours` Table

New columns added to store tour-level settings:

- `tour_settings` (JSONB) - General tour configuration
- `travel_plan` (JSONB) - High-level travel routing between dates
- `tour_contacts` (JSONB) - Tour-wide contacts (promoters, tour managers, etc.)
- `default_timezone` (TEXT) - Default timezone for the tour
- `scheduling_preferences` (JSONB) - Default timing and buffer preferences

**Example data structures** defined in `/src/types/tourScheduling.ts`:
- `TourSettings`
- `SchedulingPreferences`
- `TourContact`

### 2. Extended `hoja_de_ruta` Table

New columns added for day-specific itinerary details:

- `tour_date_id` (UUID) - Link to tour_dates table
- `hotel_info` (JSONB) - Hotel booking information
- `restaurants_info` (JSONB) - Dining reservations
- `local_contacts` (JSONB) - Day-specific local contacts
- `venue_technical_specs` (JSONB) - Venue technical specifications
- `crew_calls` (JSONB) - Department call times
- `alerts` (JSONB) - Important notices for the day
- `logistics_info` (JSONB) - Loading, parking, and access details

**Example data structures** defined in `/src/types/tourScheduling.ts`:
- `HotelInfo`
- `RestaurantInfo`
- `LocalContact`
- `VenueTechnicalSpecs`
- `CrewCall`
- `Alert`
- `LogisticsInfo`

### 3. New `tour_timeline_events` Table

Tracks non-show events in the tour timeline:

**Purpose:** Store events like travel days, days off, rehearsals, and meetings

**Key Fields:**
- `event_type` - 'travel', 'day_off', 'rehearsal', 'meeting', 'other'
- `title`, `description` - Event details
- `date`, `start_time`, `end_time` - Timing
- `location_id`, `location_details` - Where it happens
- `metadata` (JSONB) - Additional event-specific data
- `visible_to_crew`, `departments` - Visibility controls

**TypeScript Types:** `TimelineEventType`, `TimelineEventMetadata`

### 4. New `tour_travel_segments` Table

Detailed travel planning between tour dates:

**Purpose:** Track transportation details for each leg of the tour

**Key Fields:**
- `from_tour_date_id`, `to_tour_date_id` - Segment routing
- `transportation_type` - 'bus', 'van', 'flight', 'train', 'ferry', 'truck'
- `departure_time`, `arrival_time` - Travel timing
- `carrier_name`, `vehicle_details` (JSONB) - Transportation details
- `distance_km`, `estimated_duration_minutes` - Trip metrics
- `crew_manifest` (JSONB) - Who's traveling
- `stops` (JSONB) - Rest stops, fuel stops, etc.
- `estimated_cost_eur`, `actual_cost_eur` - Cost tracking
- `status` - 'planned', 'confirmed', 'in_progress', 'completed', 'cancelled'

**TypeScript Types:** `TravelSegment`, `TransportationType`, `TravelSegmentStatus`

### 5. New `tour_accommodations` Table

Hotel booking and accommodation management:

**Purpose:** Track where the crew stays for each tour date

**Key Fields:**
- `hotel_name`, `hotel_address`, `hotel_phone`, `hotel_email` - Hotel details
- `location_id`, `latitude`, `longitude` - Geographic location
- `check_in_date`, `check_out_date` - Stay dates
- `confirmation_number` - Booking reference
- `rooms_booked`, `room_type`, `room_allocation` (JSONB) - Room details
- `breakfast_included`, `parking_available`, `wifi_available` - Amenities
- `rate_per_room_eur`, `total_cost_eur` - Cost tracking
- `status` - 'tentative', 'confirmed', 'checked_in', 'checked_out', 'cancelled'

**TypeScript Types:** `HotelInfo`, `RoomAllocation`, `AccommodationStatus`

### 6. New `tour_schedule_templates` Table

Reusable schedule templates for different venue types:

**Purpose:** Store and reuse standard schedules for common show types

**Key Fields:**
- `name`, `description` - Template identification
- `template_type` - 'festival', 'theater', 'arena', 'club', 'outdoor'
- `default_schedule` (JSONB) - ProgramDay[] structure
- `default_crew_calls` (JSONB) - Standard call times
- `default_timing` (JSONB) - Default show timing
- `is_global` - Can be used across tours
- `tour_id` - Tour-specific templates (nullable)

**TypeScript Types:** `ScheduleTemplateType`, `ProgramDay`, `DefaultTiming`

### 7. Security (RLS Policies)

All new tables have Row Level Security enabled with policies:

- **SELECT:** Tour crew members + management can view
- **INSERT/UPDATE/DELETE:** Only management/admin can modify

### 8. Helper Functions

Two new database functions for querying tour data:

#### `get_tour_complete_timeline(tour_id)`

Returns combined timeline of shows and events, sorted by date:

```sql
SELECT * FROM get_tour_complete_timeline('tour-uuid-here');
```

Returns:
- `event_date` - The date
- `event_type` - 'show' or event type
- `event_data` - JSONB with event details

#### `get_tour_date_complete_info(tour_date_id)`

Returns all information for a specific tour date:

```sql
SELECT * FROM get_tour_date_complete_info('tour-date-uuid-here');
```

Returns JSONB with:
- `tour_date` - Tour date record
- `hoja_de_ruta` - Day sheet information
- `accommodation` - Hotel booking (if any)
- `travel_from` - Outbound travel segments
- `travel_to` - Inbound travel segments

## How to Apply

### Option 1: Supabase CLI (Recommended)

```bash
# Make sure you're in the project root
cd /home/javi/area-tecnica

# Link to your Supabase project (if not already linked)
npx supabase link --project-ref <your-project-ref>

# Apply the migration
npx supabase db push

# Generate updated TypeScript types
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Option 2: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `20251030000000_tour_scheduling_and_timeline_system.sql`
4. Paste and run the SQL

### Option 3: Direct SQL

If you have direct database access:

```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/20251030000000_tour_scheduling_and_timeline_system.sql
```

## Post-Migration Steps

### 1. Regenerate TypeScript Types

After applying the migration, regenerate the Supabase types to get type definitions for the new tables:

```bash
# If using local Supabase
npx supabase gen types typescript --local > src/integrations/supabase/types.ts

# If using remote Supabase
npx supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
```

### 2. Import Custom Types

The custom TypeScript types for JSONB structures are already defined in:
```
/src/types/tourScheduling.ts
```

Import them in your components as needed:

```typescript
import {
  TourSettings,
  HotelInfo,
  TravelSegment,
  CrewCall,
  // ... etc
} from '@/types/tourScheduling';
```

### 3. Update Components

The new database schema supports the tour scheduling UI components. Update your queries to use the new tables and fields:

```typescript
// Example: Query tour timeline
const { data: timeline } = await supabase
  .rpc('get_tour_complete_timeline', { p_tour_id: tourId });

// Example: Query accommodations for a tour
const { data: hotels } = await supabase
  .from('tour_accommodations')
  .select('*')
  .eq('tour_id', tourId);

// Example: Update hoja_de_ruta with hotel info
const { error } = await supabase
  .from('hoja_de_ruta')
  .update({
    hotel_info: {
      name: 'Hotel Intercontinental',
      address: 'Paseo de la Castellana, 49',
      phone: '+34 917 00 73 00',
      // ... other fields
    }
  })
  .eq('id', hojaId);
```

## Rollback

If you need to rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS public.tour_schedule_templates CASCADE;
DROP TABLE IF EXISTS public.tour_accommodations CASCADE;
DROP TABLE IF EXISTS public.tour_travel_segments CASCADE;
DROP TABLE IF EXISTS public.tour_timeline_events CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.get_tour_date_complete_info(UUID);
DROP FUNCTION IF EXISTS public.get_tour_complete_timeline(UUID);

-- Remove columns from hoja_de_ruta
ALTER TABLE public.hoja_de_ruta
  DROP COLUMN IF EXISTS tour_date_id,
  DROP COLUMN IF EXISTS hotel_info,
  DROP COLUMN IF EXISTS restaurants_info,
  DROP COLUMN IF EXISTS local_contacts,
  DROP COLUMN IF EXISTS venue_technical_specs,
  DROP COLUMN IF EXISTS crew_calls,
  DROP COLUMN IF EXISTS alerts,
  DROP COLUMN IF EXISTS logistics_info;

-- Remove columns from tours
ALTER TABLE public.tours
  DROP COLUMN IF EXISTS tour_settings,
  DROP COLUMN IF EXISTS travel_plan,
  DROP COLUMN IF EXISTS tour_contacts,
  DROP COLUMN IF EXISTS default_timezone,
  DROP COLUMN IF EXISTS scheduling_preferences;
```

## Testing

After applying the migration, test the new functionality:

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE 'tour%';
   ```

2. **Test RLS policies:**
   - Log in as different user roles
   - Verify appropriate access to tour data

3. **Test helper functions:**
   ```sql
   -- Test timeline function
   SELECT * FROM get_tour_complete_timeline('<test-tour-id>');

   -- Test tour date info function
   SELECT * FROM get_tour_date_complete_info('<test-tour-date-id>');
   ```

4. **Insert test data:**
   ```sql
   -- Test inserting a timeline event
   INSERT INTO tour_timeline_events (tour_id, event_type, title, date)
   VALUES ('<tour-id>', 'day_off', 'Rest Day', '2025-11-15');

   -- Test inserting a travel segment
   INSERT INTO tour_travel_segments (tour_id, transportation_type, status)
   VALUES ('<tour-id>', 'bus', 'planned');
   ```

## Impact Assessment

### Breaking Changes
- None. This migration only adds new tables and columns. Existing functionality is not affected.

### Database Size Impact
- Minimal. New tables start empty and grow as tour scheduling features are used.
- JSONB columns use PostgreSQL's efficient binary storage.

### Performance Impact
- New indexes are created for optimal query performance
- RLS policies are optimized to use existing indexes where possible
- Helper functions use efficient joins and are marked as `SECURITY DEFINER`

## Related Files

- **Migration SQL:** `/supabase/migrations/20251030000000_tour_scheduling_and_timeline_system.sql`
- **Custom Types:** `/src/types/tourScheduling.ts`
- **Supabase Types:** `/src/integrations/supabase/types.ts` (auto-generated)

## Support

For questions or issues with this migration:
1. Check the TypeScript type definitions in `/src/types/tourScheduling.ts`
2. Review the SQL migration file for detailed field structures
3. Test with small datasets first before bulk data entry

## Version History

- **2025-10-30:** Initial migration created
  - Added 4 new tables
  - Extended 2 existing tables
  - Created 2 helper functions
  - Added comprehensive RLS policies
