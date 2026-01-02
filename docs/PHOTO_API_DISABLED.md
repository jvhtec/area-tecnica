# Google Places Photo API - Completely Disabled

## Problem
Google Places Photo API was costing **€15/month** (up from €0) after the November 25, 2025 Hoja de Ruta feature deployment.

## Root Cause
Automatic photo fetching in 3 locations:
1. **ModernVenueSection.tsx**: Auto-fetched 1-2 photos every time a venue was viewed (~70-80 photos/day)
2. **venue.ts (PDF)**: Auto-fetched photos during PDF generation if no manual uploads
3. **accommodation.ts (PDF)**: Auto-fetched hotel photos during PDF generation

### Cost Breakdown
- ~2,100-2,400 photos/month × $0.007/photo ≈ **€15/month**
- Place Details API calls (3,137) were within free tier (100k/month)
- **Only photo fetches were causing charges**

## Solution: Complete Disable

All automatic photo fetching has been **completely disabled**:

### Files Modified

#### 1. `src/components/hoja-de-ruta/sections/ModernVenueSection.tsx`
```diff
- Auto-fetch venue photos from Google Places API
+ DISABLED: Users must manually upload venue photos
```

#### 2. `src/utils/hoja-de-ruta/pdf/sections/venue.ts`
```diff
- Fetch photos if no previews available
+ ONLY use manually uploaded previews (no API fetch)
```

#### 3. `src/utils/hoja-de-ruta/pdf/sections/accommodation.ts`
```diff
- Auto-fetch hotel images via Places API
+ DISABLED: Users must manually upload accommodation photos
```

## Impact

### ✅ Benefits
- **Cost: €15/month → €0/month**
- No more automatic API charges
- Place Details API still available (within free 100k/month tier)

### ⚠️ User Experience Changes
- **Venue photos**: Users must manually upload venue photos (no auto-suggestions)
- **PDF generation**: Will only include manually uploaded photos
- **Accommodation**: No automatic hotel photos in PDFs

## Alternative Solutions (Not Implemented)

If you want to re-enable photo fetching with controls:

### Option 1: Manual "Load Photos" Button
Add a button in ModernVenueSection that users click to fetch photos (not automatic).

### Option 2: Admin-Only Photo Fetch
Only allow photo fetching for admin/manager roles, disable for technicians.

### Option 3: Photo Fetch Budget
Implement a monthly budget (e.g., max 200 photos/month) with usage tracking.

### Option 4: Database Photo Cache
Pre-fetch and cache photos for common venues in database, serve from there instead of API.

## Reverting Changes

To re-enable automatic photo fetching (⚠️ will incur €15/month cost):

1. **ModernVenueSection.tsx** (line 58): Uncomment the `useEffect` hook
2. **venue.ts** (line 53): Uncomment the `else if` block
3. **accommodation.ts** (line 33): Uncomment the entire `try-catch` block

## Monitoring

- Check Google Cloud Console monthly to verify €0 photo API usage
- Place Details API usage should stay under 100k/month (currently ~3,137/month)
- Autocomplete/Text Search are also paid but controlled by rate limiting

## Recommendations

1. **Create venue photo database**: Pre-populate common venues with photos
2. **Train users**: Show users how to upload venue photos manually
3. **PDF templates**: Add placeholder images for venues without photos
4. **Consider static images**: Use venue logos or generic venue images instead

---

**Status**: ✅ Photo API completely disabled
**Monthly Cost**: €0
**Date Applied**: 2026-01-01
**Previously**: €15/month
