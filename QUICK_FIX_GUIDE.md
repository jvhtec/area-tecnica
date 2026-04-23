# Quick Fix Guide: 187 RLS Policies Performance Issues

You have **187 policies across 77 tables** that need performance optimization.

I've created **TWO approaches** - pick whichever you prefer:

---

## ⚡ APPROACH 1: Direct Fix (EASIEST - Recommended)

**Fixes all 187 policies automatically in one script**

### Steps:

1. Open **Supabase SQL Editor**

2. Copy and paste the entire contents of this file:
   ```
   supabase/.temp/fix_all_policies_direct.sql
   ```

3. Click **Run**

4. Watch the progress messages - it will show:
   ```
   Fixed 10 policies so far...
   Fixed 20 policies so far...
   ...
   RLS POLICY FIX COMPLETE!
   Total policies fixed: 187
   ```

5. **Done!** All policies are now optimized

### Verify:

Re-run the diagnostic query to confirm 0 policies remain:
```sql
-- Should show: total_policies_needing_fix: 0
SELECT COUNT(*) as policies_still_needing_fix
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual::text ~ 'auth\.(uid|jwt|role)\(\)' OR with_check::text ~ 'auth\.(uid|jwt|role)\(\)')
  AND NOT ((qual IS NULL OR qual::text ~ '\(select auth\.') AND (with_check IS NULL OR with_check::text ~ '\(select auth\.'));
```

---

## 📝 APPROACH 2: Generate & Review (More Control)

**Generates SQL for you to review before applying**

### Steps:

1. Open **Supabase SQL Editor**

2. Run the generator script:
   ```
   supabase/.temp/generate_policy_fixes.sql
   ```

3. **Copy ALL output** from the `fix_sql` column (will be ~2000+ lines)

4. Open this file in your editor:
   ```
   supabase/migrations/20251217000001_fix_remaining_rls_policies.sql
   ```

5. **Paste** the generated SQL between the `BEGIN;` and `COMMIT;` statements

6. **Save and push** the migration:
   ```bash
   git add supabase/migrations/20251217000001_fix_remaining_rls_policies.sql
   git commit -m "fix: apply remaining 187 RLS policy performance fixes"
   git push
   ```

---

## 🎯 Which Approach Should I Use?

| Criteria | Approach 1 (Direct) | Approach 2 (Generate) |
|----------|---------------------|----------------------|
| **Speed** | ✅ Fastest | Slower (manual paste) |
| **Review** | ❌ No review | ✅ Can review SQL before applying |
| **Migration Tracking** | ❌ Not tracked in git | ✅ Tracked as migration file |
| **Rollback** | Harder | Easier (standard migration rollback) |

**My recommendation:** Use **Approach 1** if you trust the automated fix. Use **Approach 2** if you want to review the changes or track in migrations.

---

## ✅ After Fixing

1. **Check Supabase Dashboard**
   - Go to Database → Linter
   - Warnings should drop from 1000+ to 0

2. **Monitor Performance**
   - Queries should be noticeably faster
   - Especially queries returning many rows

3. **Clean up** (optional):
   ```bash
   # The .temp folder can be deleted after fixes are applied
   rm -rf supabase/.temp/
   ```

---

## 📊 What Tables Will Be Fixed?

Based on your 187 policies across 77 tables, this likely includes:

- ✅ Core tables: `profiles`, `jobs`, `timesheets`, `job_assignments`
- ✅ Assignment tables: `tour_assignments`, `assignment_audit_log`
- ✅ Skills & inventory: `profile_skills`, `stock_movements`
- ✅ Equipment: Various equipment-related tables
- ✅ Notifications: Notification preference tables
- ✅ And 70+ more tables

---

## 🔍 Technical Details

**The Fix:**
```sql
-- Before (evaluated per row ❌)
auth.uid() = user_id

-- After (evaluated once per query ✅)
(SELECT auth.uid()) = user_id
```

**Performance Impact:**
- Query on 1000 rows: ~1000x faster
- Query on 10000 rows: ~10000x faster
- Larger datasets = bigger performance gains

---

## 🆘 Troubleshooting

**"Error fixing policies"**
- Check if you have permission in Supabase
- Try running as service_role or admin user

**"Still seeing warnings after fix"**
- Re-run diagnostic query to check count
- May need to refresh Supabase dashboard cache

**"Want to rollback"**
- Policies can be reverted by unwrapping: `(SELECT auth.uid())` → `auth.uid()`

---

**Questions?** Check the detailed guide: `supabase/.temp/README_RLS_PERFORMANCE_FIX.md`
