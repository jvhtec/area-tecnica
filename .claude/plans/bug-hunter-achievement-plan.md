# Bug Hunter Achievement Implementation Plan

## Overview

Add a "Bug Hunter" achievement that can be:
1. **Automatically awarded** when a user reports 5+ bugs through the bug reporting system
2. **Manually awarded** by managers/admins from settings>users>achievements

## Current State Analysis

### Achievements System
- All achievements are currently **metric-based** and **automatically evaluated**
- Evaluation triggered on job completion via PostgreSQL trigger
- 30 seed achievements across 6 categories (volume, house_tech, reliability, endurance, diversity, hidden)
- No current mechanism for manual achievement awards
- Achievement catalog in `achievements` table
- Progress tracking in `achievement_progress` table
- Unlock records in `achievement_unlocks` table

### Bug Reporting System
- Bug reports stored in `bug_reports` table with `created_by` field
- No current tracking of bug report count as a metric
- No integration with achievements system
- Submission via `submit-bug-report` Edge Function

## Implementation Steps

### 1. Database Schema Changes

#### A. Add Bug Hunter Achievement to Seed Data
**File:** `supabase/migrations/20260208100000_create_achievement_tables.sql`

Add new achievement to INSERT statement:

```sql
{
  code: 'bug_hunter',
  title: 'Cazador de Bugs',
  description: 'Has reportado 5 o más bugs para ayudar a mejorar la plataforma',
  hint: 'Reporta bugs desde la página de Soporte',
  category: 'community', -- NEW category for community contributions
  evaluation_type: 'threshold',
  metric_key: 'bug_reports_submitted',
  threshold: 5,
  icon: '🐛', -- Bug emoji or custom icon
  sort_order: 31,
  is_active: true,
  is_hidden: false
}
```

**Note:** This introduces a new category "community" for achievements related to platform contributions.

#### B. Update Achievement Evaluation Function
**File:** `supabase/migrations/20260208130000_evaluate_achievements_function.sql`

Add bug report metric calculation to `evaluate_user_achievements()` function:

```sql
-- Add variable declaration
v_bug_reports integer := 0;

-- Add metric calculation (before threshold checking)
SELECT COUNT(*)::integer INTO v_bug_reports
FROM bug_reports
WHERE created_by = p_user_id;

-- Insert/update progress
INSERT INTO achievement_progress (user_id, metric_key, current_value)
VALUES (p_user_id, 'bug_reports_submitted', v_bug_reports)
ON CONFLICT (user_id, metric_key)
DO UPDATE SET
  current_value = v_bug_reports,
  last_evaluated_at = now();
```

#### C. Add Trigger for Bug Report Evaluation
**New File:** `supabase/migrations/20260213000000_trigger_evaluate_achievements_on_bug_report.sql`

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION trigger_evaluate_achievements_on_bug_report()
RETURNS TRIGGER AS $$
BEGIN
  -- Only evaluate if there's a valid user
  IF NEW.created_by IS NOT NULL THEN
    PERFORM evaluate_user_achievements(NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on bug_reports INSERT
CREATE TRIGGER on_bug_report_submitted_evaluate_achievements
  AFTER INSERT ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION trigger_evaluate_achievements_on_bug_report();
```

#### D. Add Manual Achievement Award Function
**New File:** `supabase/migrations/20260213000001_add_manual_achievement_award.sql`

```sql
-- Function to manually award achievement
CREATE OR REPLACE FUNCTION manually_award_achievement(
  p_user_id uuid,
  p_achievement_id uuid,
  p_awarded_by uuid
)
RETURNS jsonb AS $$
DECLARE
  v_awarded_by_role user_role;
  v_achievement_exists boolean;
  v_already_unlocked boolean;
  v_unlock_id uuid;
BEGIN
  -- Check if awarder is admin or management
  SELECT role INTO v_awarded_by_role
  FROM profiles
  WHERE id = p_awarded_by;

  IF v_awarded_by_role NOT IN ('admin', 'management') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only admins and management can award achievements'
    );
  END IF;

  -- Check if achievement exists and is active
  SELECT EXISTS (
    SELECT 1 FROM achievements
    WHERE id = p_achievement_id AND is_active = true
  ) INTO v_achievement_exists;

  IF NOT v_achievement_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Achievement does not exist or is not active'
    );
  END IF;

  -- Check if user already has this achievement
  SELECT EXISTS (
    SELECT 1 FROM achievement_unlocks
    WHERE user_id = p_user_id AND achievement_id = p_achievement_id
  ) INTO v_already_unlocked;

  IF v_already_unlocked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already has this achievement'
    );
  END IF;

  -- Create unlock record
  INSERT INTO achievement_unlocks (user_id, achievement_id, unlocked_at, seen)
  VALUES (p_user_id, p_achievement_id, now(), false)
  RETURNING id INTO v_unlock_id;

  RETURN jsonb_build_object(
    'success', true,
    'unlock_id', v_unlock_id,
    'message', 'Achievement awarded successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (function checks role internally)
GRANT EXECUTE ON FUNCTION manually_award_achievement TO authenticated;
```

#### E. Update RLS Policies for Manual Awards
**New File:** `supabase/migrations/20260213000002_update_achievement_unlocks_rls.sql`

```sql
-- Allow admins/management to insert achievement unlocks (for manual awards)
CREATE POLICY "Admins and management can manually award achievements"
  ON achievement_unlocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );
```

### 2. Edge Function Updates

#### Update submit-bug-report Function
**File:** `supabase/functions/submit-bug-report/index.ts`

Add achievement evaluation call after bug report is saved:

```typescript
// After saving bug report (around line ~150)
const { data: bugReport, error: insertError } = await supabaseClient
  .from('bug_reports')
  .insert(bugReportData)
  .select()
  .single();

if (insertError) throw insertError;

// NEW: Evaluate achievements for reporter
if (userId) {
  try {
    await supabaseClient.rpc('evaluate_user_achievements', {
      p_user_id: userId
    });
  } catch (evalError) {
    // Log but don't fail the request if achievement evaluation fails
    console.error('Failed to evaluate achievements:', evalError);
  }
}
```

**Rationale:** This provides immediate evaluation rather than waiting for the trigger, ensuring the user sees the achievement notification right away.

### 3. UI Components

#### A. Create Manual Award Dialog
**New File:** `src/components/achievements/ManualAwardDialog.tsx`

```typescript
interface ManualAwardDialogProps {
  targetUserId: string;
  targetUserName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Features:
// - Dropdown to select from all active achievements
// - Filter out achievements user already has
// - Confirmation step with achievement details
// - Success/error toast notifications
// - Refetch achievements on success
```

#### B. Update ViewAchievementsDialog
**File:** `src/components/users/ViewAchievementsDialog.tsx`

Add "Award Achievement" button:
- Only visible to admins/management (check `userRole` from auth context)
- Opens `ManualAwardDialog`
- Positioned in dialog header/footer

#### C. Create Manual Award Hook
**File:** `src/hooks/useAchievements.ts`

Add new hook:

```typescript
export const useManuallyAwardAchievement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      achievementId
    }: {
      userId: string;
      achievementId: string;
    }) => {
      const { data, error } = await supabase.rpc('manually_award_achievement', {
        p_user_id: userId,
        p_achievement_id: achievementId,
        p_awarded_by: (await supabase.auth.getUser()).data.user?.id
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries
      queryClient.invalidateQueries({
        queryKey: ['achievements', variables.userId]
      });
      queryClient.invalidateQueries({
        queryKey: ['unseen-achievements', variables.userId]
      });
    }
  });
};
```

#### D. Update Achievement Types
**File:** `src/types/achievements.ts`

Ensure `AchievementCategory` includes `'community'`:

```typescript
export type AchievementCategory =
  | 'volume'
  | 'house'
  | 'reliability'
  | 'endurance'
  | 'diversity'
  | 'community'  // NEW
  | 'hidden';
```

### 4. Category Filter Updates

#### Update AchievementsFilters Component
**File:** `src/components/achievements/AchievementsFilters.tsx`

Add "community" category to filter options:

```typescript
const categoryLabels: Record<string, string> = {
  all: 'Todos',
  volume: 'Volumen',
  house: 'Casa',
  reliability: 'Fiabilidad',
  endurance: 'Resistencia',
  diversity: 'Diversidad',
  community: 'Comunidad',  // NEW
  hidden: 'Ocultos'
};
```

## Testing Plan

### Automatic Award Testing

1. **Setup:**
   - Create test user account
   - Verify user has 0 bug reports initially

2. **Submit 4 bug reports:**
   - Go to /feedback
   - Submit 4 separate bug reports
   - Verify each is saved to database
   - Check `achievement_progress` table: `bug_reports_submitted` should be 4
   - Verify Bug Hunter is NOT unlocked yet

3. **Submit 5th bug report:**
   - Submit one more bug report
   - Verify `achievement_progress` shows 5
   - Check `achievement_unlocks` table for Bug Hunter unlock
   - Verify `AchievementBanner` appears with Bug Hunter notification
   - Verify achievement appears in /achievements page as unlocked

### Manual Award Testing

1. **Setup:**
   - Login as admin/management user
   - Create/select test technician user

2. **Navigate to settings>users:**
   - Find test user in list
   - Click "View Achievements" button

3. **Award Bug Hunter manually:**
   - Click "Award Achievement" button
   - Select "Cazador de Bugs" from dropdown
   - Confirm award
   - Verify success toast appears

4. **Verify unlock:**
   - Check achievement appears as unlocked for user
   - Verify `achievement_unlocks` table has record
   - Login as test user
   - Verify `AchievementBanner` shows notification
   - Verify achievement appears in /achievements page

5. **Test error cases:**
   - Try to award same achievement twice (should fail)
   - Try to award as non-admin user (should fail via RLS)

### Edge Cases

- User submits bug report while unauthenticated (guest) - should not crash
- Achievement already unlocked via automatic evaluation, then manual award attempted - should fail gracefully
- Multiple admins trying to award same achievement simultaneously - database constraint should prevent duplicates

## Rollout Steps

1. **Create branch:** `claude/add-bug-hunter-achievement-wIyZG`
2. **Database migrations:** Run all 4 migration files in order
3. **Edge function update:** Deploy `submit-bug-report` changes
4. **Frontend updates:** Deploy all UI component changes
5. **Testing:** Execute full test plan
6. **Documentation:** Update achievement docs if needed
7. **Commit and push:** Push to feature branch
8. **Create PR:** Request review before merging to dev/main

## Files to Modify

### Database Migrations (4 files)
1. `supabase/migrations/20260208100000_create_achievement_tables.sql` - Add Bug Hunter seed data
2. `supabase/migrations/20260208130000_evaluate_achievements_function.sql` - Add bug report metric
3. `supabase/migrations/20260213000000_trigger_evaluate_achievements_on_bug_report.sql` - NEW trigger
4. `supabase/migrations/20260213000001_add_manual_achievement_award.sql` - NEW manual award function
5. `supabase/migrations/20260213000002_update_achievement_unlocks_rls.sql` - NEW RLS policy

### Edge Functions (1 file)
1. `supabase/functions/submit-bug-report/index.ts` - Add evaluation call

### Frontend Components (4 files)
1. `src/components/achievements/ManualAwardDialog.tsx` - NEW manual award UI
2. `src/components/users/ViewAchievementsDialog.tsx` - Add award button
3. `src/components/achievements/AchievementsFilters.tsx` - Add community category
4. `src/hooks/useAchievements.ts` - Add manual award hook
5. `src/types/achievements.ts` - Add community category type

## Risk Analysis

### Low Risk
- Adding new achievement to catalog (isolated change)
- Adding new metric to evaluation function (additive only)
- New trigger on bug_reports (isolated, only affects achievement system)

### Medium Risk
- Manual award function (new attack surface - mitigated by RLS and role checks)
- RLS policy updates (could accidentally expose data - needs careful review)

### Mitigation Strategies
- Use `SECURITY DEFINER` on manual award function with internal role checks
- Test RLS policies thoroughly before deploying
- Add comprehensive error handling in Edge Function
- Log all manual awards for audit trail (could add `awarded_by` column to `achievement_unlocks`)

## Future Enhancements

1. **Audit Trail:** Add `awarded_by` and `award_type` (auto/manual) to `achievement_unlocks`
2. **Notification:** Send email/push notification when achievement manually awarded
3. **Bulk Awards:** Allow admins to award achievement to multiple users at once
4. **Achievement Analytics:** Track which achievements are most commonly awarded manually
5. **Community Category Expansion:** Add more community-focused achievements (feature requester, documentation contributor, etc.)

## Success Criteria

- [ ] Bug Hunter achievement appears in achievements catalog
- [ ] Automatic award works when user submits 5th bug report
- [ ] Manual award works from settings>users>achievements
- [ ] Both award methods create proper unlock records
- [ ] Achievement banner shows for newly unlocked achievements
- [ ] All tests pass
- [ ] No breaking changes to existing achievement system
- [ ] RLS policies protect against unauthorized awards

## Timeline Estimate

**Note:** Following project guidelines - no time estimates provided. Tasks broken into discrete steps for clear progress tracking.
