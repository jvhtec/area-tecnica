-- Migration: Add advisory lock function for assignment operations
-- Prevents race conditions during concurrent assignment confirmations

CREATE OR REPLACE FUNCTION acquire_assignment_lock(
  p_technician_id UUID,
  p_date DATE
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_key BIGINT;
BEGIN
  -- Generate deterministic lock key from technician+date
  -- Use MD5 hash to create a stable 64-bit integer
  v_lock_key := ('x' || substr(md5(p_technician_id::text || p_date::text), 1, 15))::bit(60)::bigint;
  
  -- Try to acquire advisory lock (non-blocking, transaction-scoped)
  -- Returns true if lock acquired, false if already locked
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION acquire_assignment_lock TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_assignment_lock TO service_role;

COMMENT ON FUNCTION acquire_assignment_lock IS 
  'Acquires a transaction-scoped advisory lock for a technician on a specific date. 
   Prevents double-booking race conditions during concurrent assignment operations.
   Lock is automatically released at transaction end (commit or rollback).';
