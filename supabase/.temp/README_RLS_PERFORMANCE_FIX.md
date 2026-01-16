# RLS Performance Fix Guide

## Problem

You have 1000+ Supabase performance warnings because RLS policies are using `auth.uid()`, `auth.jwt()`, and `auth.role()` without wrapping them in subqueries. This causes these functions to be re-evaluated for **every row**, creating massive performance issues at scale.

## Solution Overview

Wrap all auth function calls in `SELECT` subqueries so they're evaluated **once per query** instead of once per row:

```sql
-- ❌ BAD (re-evaluated for each row)
auth.uid() = user_id

-- ✅ GOOD (evaluated once per query)
(SELECT auth.uid()) = user_id
```

## Step-by-Step Fix Process

### Step 1: Diagnose Current State

Run this query in your **Supabase SQL Editor** to see all policies that need fixing:

```bash
cat supabase/.temp/diagnose_rls_policies.sql
```

Copy and paste the contents into Supabase SQL Editor and run it. This will show you:
- All policies with unwrapped auth functions
- Which tables are affected
- Total count of policies needing fixes

### Step 2: Apply the Main Migration

The migration file `20251217000000_fix_rls_performance_all_policies.sql` fixes **27 policies** across these tables:

- `bug_reports` (4 policies)
- `feature_requests` (4 policies)
- `storage.objects` (1 policy)
- `assignment_audit_log` (2 policies)
- `expense_categories` (1 policy)
- `expense_permissions` (2 policies)
- `job_expenses` (4 policies)
- `job_technician_payout_overrides` (4 policies)

**Apply this migration:**

```bash
# If using local Supabase CLI
supabase db push

# Or push to GitHub and deploy
git add .
git commit -m "fix: optimize RLS policies for performance"
git push
```

### Step 3: Find Any Remaining Policies

After applying the migration, run the diagnostic query again (Step 1) to see if there are any remaining policies.

If you see additional policies (likely for tables like `profiles`, `jobs`, `timesheets`, `job_assignments`, `profile_skills`, `stock_movements`), proceed to Step 4.

### Step 4: Auto-Generate Fixes for Remaining Policies

Run this query in **Supabase SQL Editor**:

```bash
cat supabase/.temp/generate_policy_fixes.sql
```

This will:
1. Automatically generate `DROP POLICY` and `CREATE POLICY` statements
2. Show you the exact SQL needed to fix remaining policies
3. Include a summary of affected tables

**Copy the output** and create a new migration file:

```bash
# Create a new migration
touch supabase/migrations/20251217000001_fix_remaining_rls_policies.sql

# Paste the generated SQL into this file
# Then apply the migration
```

### Step 5: Verify the Fix

After all migrations are applied, run the diagnostic query one more time. You should see:

```
total_policies_needing_fix: 0
affected_tables: 0
```

Check your Supabase dashboard - the 1000+ warnings should be gone! 🎉

## Why This Happens

The core tables (`profiles`, `jobs`, `timesheets`, etc.) likely had their RLS policies created before migration tracking started. That's why they're not in the migration files but exist in your live database.

## Files Created

1. **`supabase/migrations/20251217000000_fix_rls_performance_all_policies.sql`**
   - Main migration fixing 27 known policies

2. **`supabase/.temp/diagnose_rls_policies.sql`**
   - Diagnostic query to find all policies needing fixes

3. **`supabase/.temp/generate_policy_fixes.sql`**
   - Auto-generator for fixing any remaining policies

4. **`supabase/.temp/README_RLS_PERFORMANCE_FIX.md`**
   - This guide

## Expected Impact

- **Performance**: Queries will be significantly faster at scale
- **Database Load**: Reduced CPU usage on database
- **Warnings**: 1000+ Supabase warnings will disappear
- **No Downtime**: Policies are updated atomically
- **No Behavior Change**: Authorization logic remains identical

## References

- [Supabase RLS Performance Docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Database Linter: auth_rls_initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
