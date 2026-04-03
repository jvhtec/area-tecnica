-- =============================================================================
-- Migration: Add prep_day job type
-- Prep days are associated with a parent job, appear in the assignment matrix,
-- and compute timesheets at a flat 15€/hr (hours × 15).
-- =============================================================================

-- 1. Add 'prep_day' to job_type enum
ALTER TYPE public.job_type ADD VALUE IF NOT EXISTS 'prep_day';
