# Push Subscription Recovery System

## Overview

This system detects when users have lost their push notification subscriptions and prompts them to re-enable. This addresses the issue where users who reinstall the PWA or clear browser data lose their push subscriptions.

**Important**: Our PWA update system eliminates most reinstall scenarios, so this is primarily a safeguard for edge cases.

---

## The Problem

### When Push Subscriptions Are Lost

Push subscriptions can be lost when:
1. ❌ **Browser data is cleared** (user clears all site data)
2. ❌ **PWA is uninstalled and reinstalled** (rare with our update system)
3. ❌ **User switches devices** (different browser/device)
4. ❌ **Subscription expires** (rare, but possible)

### Why We Can't Auto-Restore

**Browser security prevents automatic restoration:**
- Each push subscription is cryptographically tied to the browser/device
- Subscriptions are invalidated when the PWA is uninstalled
- Browsers require explicit user permission for push notifications
- Old subscriptions cannot be reused

**We can only prompt users to re-enable.**

---

## The Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Enables Push                         │
│                                                              │
│  1. enablePush() called                                      │
│  2. Browser creates push subscription                        │
│  3. Subscription sent to backend                             │
│  4. profiles.push_notifications_enabled = true ←──────────── │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  User Loses Subscription                     │
│                                                              │
│  (Clear data / Reinstall PWA / Switch device)                │
│                                                              │
│  - Push subscription is invalidated                          │
│  - profiles.push_notifications_enabled = true (still set)    │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Recovery Detection & Prompt                     │
│                                                              │
│  1. App loads → usePushSubscriptionRecovery runs             │
│  2. Checks: push_notifications_enabled === true              │
│  3. Checks: currentSubscription === null                     │
│  4. Mismatch detected!                                       │
│  5. Shows toast: "Notificaciones push desactivadas"          │
│  6. User clicks [Reactivar] → navigates to settings          │
│  7. User manually re-enables push                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### 1. Database Schema

**Migration:** `docs/migrations/add_push_notifications_preference.sql`

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS push_notifications_enabled boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_push_enabled
ON profiles(push_notifications_enabled)
WHERE push_notifications_enabled = true;
```

**Purpose:** Track user's push notification preference separately from browser subscription.

---

### 2. Preference Tracking

**File:** `src/lib/push.ts`

#### When User Enables Push

```typescript
export const enablePush = async (vapidPublicKey: string) => {
  // ... create subscription ...

  // Track preference in database
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .update({ push_notifications_enabled: true })
      .eq('id', user.id)
  }

  return subscription
}
```

#### When User Disables Push

```typescript
export const disablePush = async () => {
  // ... unsubscribe ...

  // Clear preference in database
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase
      .from('profiles')
      .update({ push_notifications_enabled: false })
      .eq('id', user.id)
  }
}
```

---

### 3. Recovery Detection Hook

**File:** `src/hooks/usePushSubscriptionRecovery.ts`

```typescript
export function usePushSubscriptionRecovery() {
  useEffect(() => {
    const checkForLostSubscription = async () => {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // 2. Check if user had push enabled
      const { data: profile } = await supabase
        .from('profiles')
        .select('push_notifications_enabled')
        .eq('id', user.id)
        .single()

      if (!profile?.push_notifications_enabled) {
        return // Never enabled or disabled intentionally
      }

      // 3. Check if subscription exists
      const currentSubscription = await getExistingPushSubscription()

      if (currentSubscription) {
        return // All good!
      }

      // 4. Subscription lost - prompt user
      toast.warning('Notificaciones push desactivadas', {
        description: '¿Quieres reactivarlas?',
        action: {
          label: 'Reactivar',
          onClick: () => window.location.hash = '#/profile'
        }
      })
    }

    setTimeout(checkForLostSubscription, 3000)
  }, [])
}
```

**Key Features:**
- ✅ Only checks once per session (not annoying)
- ✅ Waits 3 seconds after app load (doesn't block startup)
- ✅ Only prompts if subscription was legitimately lost
- ✅ Provides clear action to re-enable

---

### 4. Integration

**File:** `src/App.tsx`

```typescript
function PushSubscriptionRecoveryInit() {
  usePushSubscriptionRecovery()
  return null
}

// Added to component tree
<OptimizedAuthProvider>
  <AppInit />
  <ActivityPushFallbackInit />
  <ServiceWorkerUpdateInit />
  <PushSubscriptionRecoveryInit /> {/* New */}
  <TechnicianRouteGuard />
  {/* ... */}
</OptimizedAuthProvider>
```

---

## User Experience

### Scenario 1: Normal Update (No Reinstall)

```
User has PWA installed with push enabled
→ You deploy new version
→ User clicks "Actualizar"
→ App reloads
→ ✅ Push subscription preserved
→ No recovery prompt needed
```

### Scenario 2: Lost Subscription Detected

```
User clears browser data (or rare reinstall)
→ App loads
→ After 3 seconds: Recovery hook runs
→ Detects: push_notifications_enabled = true, but no subscription
→ Shows toast: "Notificaciones push desactivadas"
→ User clicks [Reactivar]
→ Navigates to /profile
→ User manually enables push again
→ New subscription created
→ All set!
```

### Scenario 3: User Disabled Push Intentionally

```
User disables push in settings
→ disablePush() called
→ push_notifications_enabled = false
→ App loads later
→ Recovery hook runs
→ Sees: push_notifications_enabled = false
→ ✅ No prompt (respects user's choice)
```

---

## Benefits

### 1. **User-Friendly Recovery**
- Automatic detection (no support needed)
- Clear, actionable prompt
- One-click navigation to settings

### 2. **Respects User Intent**
- Only prompts if subscription was lost, not disabled
- Doesn't repeatedly nag (once per session)
- User can dismiss if desired

### 3. **Reduces Support Burden**
- Users know exactly what to do
- No "why aren't I getting notifications?" tickets
- Self-service recovery

### 4. **Edge Case Protection**
- Handles browser data clearing
- Handles device switches
- Handles rare reinstall scenarios

---

## Testing

### Test Lost Subscription Detection

1. **Enable push notifications** in the app
2. **Verify** `profiles.push_notifications_enabled = true` in database
3. **Clear all browser data** for your site
4. **Reload the app**
5. **Wait 3-5 seconds**
6. **Verify** toast appears: "Notificaciones push desactivadas"
7. **Click [Reactivar]**
8. **Verify** navigates to profile/settings
9. **Re-enable push** manually
10. **Reload app** - no prompt should appear

### Test Intentional Disable

1. **Enable push** notifications
2. **Disable push** via settings
3. **Verify** `profiles.push_notifications_enabled = false` in database
4. **Reload the app**
5. **Verify** NO recovery prompt appears

### Test Normal Operation

1. **Enable push** notifications
2. **Deploy a new version**
3. **Click [Actualizar]** in update toast
4. **Verify** app reloads
5. **Verify** push subscription still works
6. **Verify** NO recovery prompt appears

---

## Limitations

### What This System CANNOT Do

❌ **Automatically restore lost subscriptions**
- Browser security prevents this
- Users must explicitly grant permission again

❌ **Detect every edge case**
- Relies on database preference being set
- If database is also cleared, detection won't work

❌ **Prevent subscription loss**
- Can only detect and prompt for recovery

### What This System CAN Do

✅ **Detect when subscriptions are lost**
✅ **Prompt users to re-enable**
✅ **Guide users to the right place**
✅ **Respect user intent**
✅ **Avoid being annoying**

---

## Maintenance

### Database Query

Check how many users have lost subscriptions:

```sql
-- Users with push enabled in DB but likely missing subscriptions
SELECT id, email, push_notifications_enabled
FROM profiles
WHERE push_notifications_enabled = true;

-- Cross-reference with active subscriptions in your push subscriptions table
```

### Monitoring

Watch for:
- High rate of recovery prompts (indicates systemic issue)
- Users re-enabling frequently (might indicate browser/device issues)
- Recovery prompt not appearing (hook not running)

---

## Future Enhancements

Potential improvements:

1. **Subscription Validation**
   - Periodically check if subscriptions are still valid
   - Detect expired subscriptions before users notice

2. **Device Fingerprinting**
   - Track which devices have active subscriptions
   - Detect device switches more accurately

3. **Recovery Analytics**
   - Track how often recovery prompts appear
   - Measure re-enablement success rate

4. **Smart Timing**
   - Show prompt at more opportune moments
   - Avoid showing during critical workflows

---

## Summary

This system provides a safety net for the rare cases where users lose their push subscriptions. Combined with our PWA update system, it ensures users:

1. ✅ **Rarely need to reinstall** (update system handles that)
2. ✅ **Know when subscriptions are lost** (automatic detection)
3. ✅ **Can easily recover** (one-click to settings)
4. ✅ **Aren't annoyed** (once per session, respects intent)

**Result:** Better user experience with minimal support overhead.
