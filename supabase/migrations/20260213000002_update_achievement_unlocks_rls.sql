-- ============================================================================
-- RLS Policy for Manual Achievement Awards
-- Allows admins/management to insert achievement unlocks
-- ============================================================================

-- Allow admins and management to manually award achievements
CREATE POLICY "Admins and management can manually award achievements"
  ON achievement_unlocks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );
