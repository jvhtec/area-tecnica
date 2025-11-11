-- Add metadata columns for tracking inline image retention and cleanup
ALTER TABLE corporate_email_logs
  ADD COLUMN IF NOT EXISTS inline_image_paths TEXT[],
  ADD COLUMN IF NOT EXISTS inline_image_retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inline_image_cleanup_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN corporate_email_logs.inline_image_paths IS 'Storage object paths for inline images referenced by the email body';
COMMENT ON COLUMN corporate_email_logs.inline_image_retention_until IS 'Timestamp after which inline images can be purged from storage';
COMMENT ON COLUMN corporate_email_logs.inline_image_cleanup_completed_at IS 'Timestamp when the cleanup job removed inline images from storage';
