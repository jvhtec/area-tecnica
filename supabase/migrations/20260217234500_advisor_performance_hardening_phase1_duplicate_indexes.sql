-- =============================================================================
-- Supabase Advisor Performance Hardening - Phase 1
-- =============================================================================
-- Remove duplicate indexes flagged by lint 0009.
-- =============================================================================

DROP INDEX IF EXISTS public.rate_cards_2025_category_unique_idx;
DROP INDEX IF EXISTS public.rate_cards_tour_2025_category_unique_idx;
