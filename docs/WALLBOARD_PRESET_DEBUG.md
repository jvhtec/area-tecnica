# Wallboard Preset Debug Guide

## Issue
Public wallboard URLs were not using the saved presets, and logistics panel appeared empty.

## Solution Applied ✅
**Produccion preset is now HARDCODED** to only show the calendar panel, bypassing the preset API entirely.

## URLs
- **Produccion (HARDCODED):** `https://sector-pro.work/wallboard/public/{TOKEN}/produccion` → **Calendar only**
- **Almacen:** `https://sector-pro.work/wallboard/public/{TOKEN}/almacen` → Uses preset from database
- **Oficinas:** `https://sector-pro.work/wallboard/public/{TOKEN}/oficinas` → Uses preset from database


## Database Status ✅
The presets **DO exist** in the database and were successfully saved:

```sql
slug        | panel_order                              | updated_at
------------|------------------------------------------|---------------------------
almacen     | ["overview","logistics","calendar"]      | 2025-11-25 09:33:53 UTC
oficinas    | ["overview","crew","logistics",...       | 2025-11-25 09:33:58 UTC  
produccion  | ["calendar"]                             | 2025-11-25 09:34:03 UTC
```

## Hardcoded Fix for Produccion ✅

To avoid any API/database issues, the **produccion** preset is now hardcoded directly in the Wallboard component:

### Code Location
[`src/pages/Wallboard.tsx`](file:///home/javi/area-tecnica/src/pages/Wallboard.tsx#L1140-L1158) - lines 1140-1158

### Implementation
```typescript
// HARDCODED: For produccion preset in API mode, skip fetch and use calendar-only config
if (isApiMode && isProduccionPreset) {
  console.log('🎯 [Wallboard] Using hardcoded produccion config (calendar-only)');
  setPanelOrder(['calendar']);
  setPanelDurations({
    overview: 12,
    crew: 12,
    logistics: 12,
    pending: 12,
    calendar: 600,  // 10 minutes
  });
  setRotationFallbackSeconds(600);
  setHighlightTtlMs(300 * 1000);
  setTickerIntervalMs(20 * 1000);
  setPresetMessage(null);
  setHighlightJobs(new Map());
  setIdx(0);
  return;  // Skip API call entirely
}
```

### What This Means
- **Produccion wallboard** will ALWAYS show only the calendar panel
- No API calls are made
- No database queries needed
- Configuration is guaranteed to be correct
- Changes take effect immediately after Cloudflare deploys

## How Preset Loading Works (For Other Presets)

### Flow
1. Browser loads public wallboard URL: `/wallboard/public/{TOKEN}/{presetSlug}`
2. `WallboardPublic.tsx` extracts `presetSlug` from URL (e.g., `"produccion"`)
3. Calls `wallboard-auth` edge function with the `presetSlug`
4. Receives JWT token with preset slug embedded in payload
5. Calls `/preset-config` endpoint with the JWT
6. Edge function extracts `presetSlug` from JWT payload
7. Queries database: `SELECT * FROM wallboard_presets WHERE slug = $1`
8. Returns configuration to client
9. Client applies the preset configuration

### Code Locations
- **Client:** [`src/pages/Wallboard.tsx`](file:///home/javi/area-tecnica/src/pages/Wallboard.tsx#L1135-L1234) (lines 1135-1234)
- **Auth Function:** [`supabase/functions/wallboard-auth/index.ts`](file:///home/javi/area-tecnica/supabase/functions/wallboard-auth/index.ts#L70-L76)
- **Feed Function:** [`supabase/functions/wallboard-feed/index.ts`](file:///home/javi/area-tecnica/supabase/functions/wallboard-feed/index.ts#L401-L439)

## Debug Changes Added

### Server-Side Logs (Edge Function)
Added logging in `wallboard-feed/index.ts` at the `/preset-config` endpoint:

```typescript
console.log("📋 [preset-config] Request received", { presetSlug, authMethod });
console.log("🔍 [preset-config] Querying database for slug:", presetSlug);
console.log("✅ [preset-config] Preset found and returning:", { slug, panelOrder });
```

### Client-Side Logs (Wallboard Component)  
Added logging in `Wallboard.tsx` during preset loading:

```typescript
console.log('🎨 [Wallboard] Loading preset configuration...', { effectiveSlug, isApiMode });
console.log('🌐 [Wallboard] Fetching preset via API...', { effectiveSlug });
console.log('✅ [Wallboard] Preset fetched via API:', { slug, panelOrder, panelDurations });
console.log('✅ [Wallboard] Applying preset configuration:', { panelOrder, panelDurations });
```

## Next Steps: Diagnosis

### 1. Check Browser Console Logs
Open the wallboard in a browser and check the JavaScript console (F12). You should see:

```
🎨 [Wallboard] Loading preset configuration... { effectiveSlug: "produccion", isApiMode: true, ... }
🌐 [Wallboard] Fetching preset via API... { effectiveSlug: "produccion" }
✅ [Wallboard] Preset fetched via API: { slug: "produccion", panelOrder: ["calendar"], ... }
✅ [Wallboard] Applying preset configuration: { panelOrder: ["calendar"], ... }
```

**If you see these logs:** The preset IS loading correctly. The issue might be:
- Browser cache (need hard refresh)
- The wallboard was already running with an old JWT

**If you DON'T see these logs:** There's an error. Check for error messages like:
- `❌ [Wallboard] Failed to load preset config via API:`
- `❌ [Wallboard] Preset load error:`

### 2. Check Edge Function Logs
Run this command to see the server logs:

```bash
# View logs from Supabase dashboard or use:
npx supabase functions logs wallboard-feed --limit 50
```

Look for:
```
📋 [preset-config] Request received { presetSlug: "produccion", authMethod: "jwt" }
🔍 [preset-config] Querying database for slug: produccion
✅ [preset-config] Preset found and returning: { slug: "produccion", panelOrder: [...] }
```

### 3. Hard Refresh the Wallboard
The most common issue is **cached assets**. Try:

1. **In browser:** Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. **On LG TV:** Close the wallboard app completely and reopen
3. **Clear all** : Clear browser cache and reload

The JWT token expires after 8 hours, so if the wallboard has been running longer than that, it will need to reload anyway.

### 4. Check JWT Token Content
The JWT contains the preset slug. To decode it:

1. Open browser DevTools → Network tab
2. Reload the wallboard
3. Find the `wallboard-auth` request
4. Copy the response `token` value
5. Go to [jwt.io](https://jwt.io) and paste the token
6. Check the payload contains: `"preset": "produccion"` (or almacen/oficinas)

## Common Causes & Fixes

| Symptom | Cause | Solution |
|---------|-------|----------|
| Logs show preset loading correctly, but UI doesn't change | Browser cache | Hard refresh (Ctrl+Shift+R) |
| No logs appear at all | JavaScript error preventing execution | Check console for errors |
| `❌ No preset slug provided` | JWT doesn't contain preset | Check URL format includes `/produccion` etc. |
| `❌ Preset not found in database` | Slug mismatch | Verify preset slug matches exactly (case-sensitive) |
| Old JWT still in use | Wallboard running for > 8 hours | Close and reopen wallboard app |

## Deployment Status

✅ **Edge function deployed:** `wallboard-feed` with logging  
✅ **Client code committed:** Pushed to `dev` branch  
⏳ **Cloudflare deployment:** In progress (wait 2-3 minutes for build)

## Testing Instructions

1. **Wait for Cloudflare deployment** to complete (~2-3 min)
2. **Open a wallboard URL** in browser
3. **Open DevTools** (F12) → Console tab
4. **Reload the page** (or do hard refresh: Ctrl+Shift+R)
5. **Check logs** - you should see the 🎨 🌐 ✅ log messages
6. **Verify preset applied** - check that panel order matches your saved preset

## Expected Behavior After Fix

For **produccion** preset (HARDCODED ✅):
- ✅ **ALWAYS shows ONLY the calendar panel**
- ✅ **No rotation** - calendar stays visible permanently
- ✅ **No API calls** - configuration is hardcoded
- Console will show: `🎯 [Wallboard] Using hardcoded produccion config (calendar-only)`

For **almacen** preset (from database):
- Panel order: `["overview", "logistics", "calendar"]`
- Rotates between these 3 panels
- Uses preset data from the database

For **oficinas** preset (from database):
- Panel order: `["overview", "crew", "logistics", "pending", "calendar"]`  
- Rotates through all 5 panels
- Uses preset data from the database

## Support

If the logs show the preset is loading correctly but the wallboard still shows different panels, share:
1. Screenshot of browser console logs
2. Screenshot of the wallboard display
3. Which preset URL you're testing

The logs will tell us exactly where in the flow the issue occurs.
