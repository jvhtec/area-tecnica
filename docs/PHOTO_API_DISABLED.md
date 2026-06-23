# Google Places Photo API - Disabled

## Current Status

Google Places Photo API remains disabled. Automatic venue/accommodation photo
fetching has been re-enabled through Wikimedia in PR 706, so this note is now a
historical record of why Google photo fetching was removed.

Current photo behavior:
- `place-photos` fetches Wikipedia lead images and Wikimedia Commons geosearch
  results.
- Results are cached in `place_api_cache`.
- No Google Places Photo Media API calls are made.

## Original Problem
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

## Original Solution: Complete Disable

All automatic Google photo fetching was **completely disabled**:

### Files Modified

#### 1. `src/components/hoja-de-ruta/sections/ModernVenueSection.tsx`
```diff
- Auto-fetch venue photos from Google Places API
+ Google Places disabled: users must manually upload venue photos
```

#### 2. `src/utils/hoja-de-ruta/pdf/sections/venue.ts`
```diff
- Fetch photos if no previews available
+ ONLY use manually uploaded previews (no API fetch)
```

#### 3. `src/utils/hoja-de-ruta/pdf/sections/accommodation.ts`
```diff
- Auto-fetch hotel images via Places API
+ Google Places disabled: users must manually upload accommodation photos
```

## Impact

### ✅ Benefits
- **Cost: €15/month → €0/month**
- No more automatic API charges
- Place Details API still available (within free 100k/month tier)

### User Experience Changes At The Time
- **Venue photos**: Users had to manually upload venue photos (no auto-suggestions)
- **PDF generation**: PDFs only included manually uploaded photos
- **Accommodation**: No automatic hotel photos in PDFs

## Alternative Solutions (Not Implemented)

If Google photo fetching is ever reconsidered:

### Option 1: Manual "Load Photos" Button
Add a button in ModernVenueSection that users click to fetch photos (not automatic).

### Option 2: Admin-Only Photo Fetch
Only allow photo fetching for admin/manager roles, disable for technicians.

### Option 3: Photo Fetch Budget
Implement a monthly budget (e.g., max 200 photos/month) with usage tracking.

### Option 4: Database Photo Cache
Pre-fetch and cache photos for common venues in database, serve from there instead of API.

## Reverting Changes

To re-enable Google automatic photo fetching (will incur cost):

1. Route calls through an edge function; never expose the Google key.
2. Use persistent caching and a hard monthly budget.
3. Prefer Wikimedia/manual uploads first.

## Monitoring

- Check Google Cloud Console monthly to verify €0 photo API usage
- Place Details API usage should stay under 100k/month (currently ~3,137/month)
- Autocomplete/Text Search have moved to Mapbox.

## Recommendations

1. Keep Wikimedia results cached.
2. Train users to upload manual photos when Wikimedia has no useful image.
3. Add placeholder images for venues without photos.
4. Consider a curated venue photo database for common venues.

---

**Status**: Google Places Photo API disabled; Wikimedia photo fallback enabled
**Monthly Cost**: €0
**Date Applied**: 2026-01-01; superseded by Wikimedia fallback in PR 706
**Previously**: €15/month
