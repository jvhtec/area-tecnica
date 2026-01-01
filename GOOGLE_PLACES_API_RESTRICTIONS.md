# Google Places API Usage Restrictions

## Summary

To keep Google Places API usage within free tier limits, several restrictions have been implemented across the codebase.

## Background

The Google Places API (New) v1 has the following pricing structure:
- **Place Details (New)**: First 100,000 calls/month are FREE (SKU: DCD1-FE97-8C71)
- **Text Search**: $0.032 per request (no free tier)
- **Autocomplete**: $0.00283 per request (no free tier)
- **Photos**: $0.007 per photo

**Current usage**: 3,137 Place Details calls

## Restrictions Implemented

### 1. Rate Limiting (`src/lib/rate-limiter.ts`)

A centralized rate limiter with conservative limits:
- **Place Details**: 10/min, 200/hour, 3,000/day (~100k/month)
- **Text Search**: 5/min, 50/hour, 500/day (minimize paid requests)
- **Autocomplete**: 10/min, 100/hour, 1,000/day (minimize paid requests)
- **Photos**: 5/min, 50/hour, 500/day
- **Nearby Search**: 5/min, 50/hour, 500/day

### 2. Persistent Caching

- Uses localStorage for 7-day cache persistence
- Caches all API responses (autocomplete, place details, photos)
- Survives page refreshes and browser restarts
- Automatic cleanup of expired cache entries

### 3. Debounce Increases

- **PlaceAutocomplete**: Increased from 400ms to 800ms
- **HotelAutocomplete**: Increased from 500ms to 800ms
- Reduces API calls during typing by 2x

### 4. Photo Limits

- **Default maxPhotos**: Reduced from 2 to 1
- Affects:
  - `place-photos` edge function
  - `PlacesImageService.getPhotosForQuery()`
  - ModernVenueSection component
  - Venue PDF section
  - Accommodation PDF section

### 5. Result Limits

- **PlaceAutocomplete**: Reduced from 6 to 5 results
- **HotelAutocomplete**: Reduced from 5 to 4 results
- Slightly reduces payload size and API costs

## Files Modified

### Core Rate Limiting
- `src/lib/rate-limiter.ts` (new)

### Autocomplete Components
- `src/components/maps/PlaceAutocomplete.tsx`
- `src/components/maps/HotelAutocomplete.tsx`

### Photo Services
- `supabase/functions/place-photos/index.ts`
- `src/utils/hoja-de-ruta/pdf/services/places-image-service.ts`
- `src/components/hoja-de-ruta/sections/ModernVenueSection.tsx`
- `src/utils/hoja-de-ruta/pdf/sections/venue.ts`

## Expected Impact

### API Call Reductions
1. **Debouncing**: ~50% reduction in autocomplete/search calls
2. **Caching**: ~60-80% reduction in repeated calls
3. **Photo limits**: 50% reduction in photo API calls
4. **Rate limiting**: Prevents accidental spikes

### Estimated Monthly Savings
- **Before**: ~6,000 Place Details + 3,000 Text Search + 2,000 Photos
- **After**: ~2,000 Place Details + 1,000 Text Search + 800 Photos
- **Cost reduction**: ~70-80% fewer API calls

## Monitoring Usage

To view current API usage stats in browser console:

```javascript
import { rateLimiter } from '@/lib/rate-limiter';
console.log(rateLimiter.getUsageStats());
```

## Future Recommendations

1. **Consider disabling autocomplete** for non-critical forms
2. **Batch geocoding operations** instead of individual requests
3. **Use static map images** instead of dynamic maps where possible
4. **Add user-facing notification** when rate limits are reached
5. **Monitor usage** in Google Cloud Console regularly

## API Key Configuration

The API key is stored in Supabase secrets:
- Edge functions access via `GOOGLE_MAPS_API_KEY` environment variable
- Client components fetch via `get-google-maps-key` edge function

## Testing

To test the restrictions:
1. Clear localStorage: `localStorage.clear()`
2. Test autocomplete components
3. Check browser console for rate limit warnings
4. Verify caching is working on repeated searches

## Notes

- Rate limits persist across browser refreshes (localStorage)
- Fallback to basic data when rate limits are exceeded
- No breaking changes to user experience
- All changes are backward compatible
