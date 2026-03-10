-- Migration: Add idempotency support to staffing_requests
-- Prevents duplicate email sends from double-clicks or network retries

-- Add idempotency_key column
ALTER TABLE staffing_requests 
ADD COLUMN IF NOT EXISTS idempotency_key UUID;

-- Create index for fast idempotency lookups (within 24h window)
CREATE INDEX IF NOT EXISTS idx_staffing_requests_idempotency 
ON staffing_requests(idempotency_key, created_at)
WHERE idempotency_key IS NOT NULL;

-- Add comment
COMMENT ON COLUMN staffing_requests.idempotency_key IS 
  'Client-generated UUID for idempotent request handling. Prevents duplicate sends within 24h window.';
