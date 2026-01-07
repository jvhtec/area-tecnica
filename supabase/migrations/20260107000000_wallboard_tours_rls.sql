-- =============================================================================
-- Wallboard Tours RLS Policy
-- =============================================================================
-- Allows public wallboard to read tour id and status to filter out cancelled tours.
-- The wallboard needs to check tour.status='cancelled' to hide job dates from
-- tours marked as "not happening".
-- =============================================================================

-- Grant SELECT on specific columns needed by wallboard
GRANT SELECT (id, status) ON tours TO anon, authenticated;

-- Create policy to allow reading id and status for all users
-- This is safe as it only exposes whether a tour is active/cancelled,
-- not any sensitive tour details
DROP POLICY IF EXISTS "Allow wallboard to read tour status" ON tours;

CREATE POLICY "Allow wallboard to read tour status"
  ON tours
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: This policy allows reading ALL columns, but the GRANT above restricts
-- the actual columns that can be accessed. If RLS is enabled on tours, this
-- ensures the wallboard can successfully query tours for filtering purposes.
