-- Rename the unused flex_id column in profiles to flex_api_key
-- This column will store per-user Flex API keys to distribute API call load
-- across multiple keys instead of hitting the 2000 calls/hour limit with a single key.
ALTER TABLE public.profiles RENAME COLUMN flex_id TO flex_api_key;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN public.profiles.flex_api_key IS 'Per-user Flex Rental Solutions API key. Used to distribute API calls across multiple keys. Falls back to global X_AUTH_TOKEN if null.';
