-- Create corporate_email_logs table to track corporate email sends
CREATE TABLE IF NOT EXISTS corporate_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor who sent the email
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Email content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,

  -- Recipients (stored as JSON array of email addresses)
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Send status
  status TEXT NOT NULL CHECK (status IN ('success', 'partial_success', 'failed')),
  sent_count INTEGER NOT NULL DEFAULT 0,
  total_recipients INTEGER NOT NULL DEFAULT 0,

  -- Optional error message
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_corporate_email_logs_actor_id ON corporate_email_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_corporate_email_logs_created_at ON corporate_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corporate_email_logs_status ON corporate_email_logs(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_corporate_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_corporate_email_logs_updated_at
  BEFORE UPDATE ON corporate_email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_corporate_email_logs_updated_at();

-- Enable Row Level Security
ALTER TABLE corporate_email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admin and management can view logs
CREATE POLICY "Admin and management can view all corporate email logs"
  ON corporate_email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Policy: Only admin and management can insert logs
-- (This is primarily for the function, but also allows manual inserts)
CREATE POLICY "Admin and management can insert corporate email logs"
  ON corporate_email_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE corporate_email_logs IS 'Audit log for corporate emails sent through the dashboard composer';
COMMENT ON COLUMN corporate_email_logs.actor_id IS 'Profile ID of the user who sent the email';
COMMENT ON COLUMN corporate_email_logs.recipients IS 'JSON array of recipient email addresses';
COMMENT ON COLUMN corporate_email_logs.status IS 'Overall send status: success (all sent), partial_success (some failed), or failed (all failed)';
