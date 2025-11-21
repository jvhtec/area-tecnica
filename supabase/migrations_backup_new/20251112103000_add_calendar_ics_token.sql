-- Technician calendar ICS token storage
-- Adds a per-profile secret token to expose a read-only ICS feed URL.

-- Ensure pgcrypto is available for token generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add the token column (unique), generate values for existing rows
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS calendar_ics_token text;

-- Ensure new rows get a token automatically
ALTER TABLE public.profiles
  ALTER COLUMN calendar_ics_token SET DEFAULT encode(extensions.gen_random_bytes(18), 'hex');

-- RPC: Rotate token for current user
CREATE OR REPLACE FUNCTION public.rotate_my_calendar_ics_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  new_token text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  new_token := encode(extensions.gen_random_bytes(18), 'hex');
  UPDATE public.profiles
  SET calendar_ics_token = new_token
  WHERE id = auth.uid();

  RETURN new_token;
END;
$$;

COMMENT ON FUNCTION public.rotate_my_calendar_ics_token IS 'Generates and returns a new ICS token for the current authenticated profile.';

GRANT EXECUTE ON FUNCTION public.rotate_my_calendar_ics_token() TO authenticated;

-- Backfill token for existing rows where null
UPDATE public.profiles
SET calendar_ics_token = encode(extensions.gen_random_bytes(18), 'hex')
WHERE calendar_ics_token IS NULL;

-- Enforce uniqueness to keep URLs secret per user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_calendar_ics_token_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_calendar_ics_token_key UNIQUE (calendar_ics_token);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.calendar_ics_token IS 'Per-technician secret token for read-only ICS calendar feed URLs.';
