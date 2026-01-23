-- Change idempotency_key from uuid to text to support semantic keys
ALTER TABLE staffing_requests
  ALTER COLUMN idempotency_key TYPE text;

-- Update the index to match
DROP INDEX IF EXISTS idx_staffing_requests_idempotency;
CREATE INDEX idx_staffing_requests_idempotency
  ON staffing_requests(idempotency_key, created_at)
  WHERE idempotency_key IS NOT NULL;
