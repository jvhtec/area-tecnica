-- Step 1: Add 'conduccion' to the enum type.
-- This must run in its own transaction before the value can be referenced
-- in constraints or inserts (see migration 20260314000001 for those).
ALTER TYPE public.job_extra_type ADD VALUE IF NOT EXISTS 'conduccion';
