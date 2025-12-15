-- Create system_errors table for bug/error reporting
CREATE TABLE IF NOT EXISTS public.system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  system TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  context JSONB,
  CONSTRAINT system_errors_system_check CHECK (char_length(system) > 0),
  CONSTRAINT system_errors_error_type_check CHECK (char_length(error_type) > 0)
);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON public.system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_user_id ON public.system_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_system_errors_system ON public.system_errors(system);
CREATE INDEX IF NOT EXISTS idx_system_errors_error_type ON public.system_errors(error_type);

-- Enable RLS
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own error reports
CREATE POLICY "Users can insert their own error reports"
  ON public.system_errors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own error reports
CREATE POLICY "Users can read their own error reports"
  ON public.system_errors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can read all error reports
CREATE POLICY "Admins can read all error reports"
  ON public.system_errors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Allow anonymous error reporting (for unhandled errors before login)
CREATE POLICY "Allow anonymous error reporting"
  ON public.system_errors
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Grant permissions
GRANT SELECT, INSERT ON public.system_errors TO authenticated;
GRANT INSERT ON public.system_errors TO anon;
