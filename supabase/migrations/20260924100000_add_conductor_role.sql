-- Drivers (conductores) for the logistics matrix.
--
-- Kept in its own migration: a new enum value cannot be referenced in the same
-- transaction that adds it, and the fleet/assignment migration that follows filters
-- profiles on this role.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'conductor';
