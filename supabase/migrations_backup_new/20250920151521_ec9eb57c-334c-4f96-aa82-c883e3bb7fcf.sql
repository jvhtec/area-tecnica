-- Fix security issues from the linter

-- Enable RLS on rate_extras_2025 table
ALTER TABLE rate_extras_2025 ENABLE ROW LEVEL SECURITY;

-- Create policies for rate_extras_2025 (read-only for all authenticated users)
CREATE POLICY rate_extras_2025_read ON rate_extras_2025
FOR SELECT USING (true);

-- Only managers can modify the rate catalog
CREATE POLICY rate_extras_2025_mgr_write ON rate_extras_2025
FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
))
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
));