-- NOTE: Do not conflict with existing public.staffing_events (used by send-staffing-email/staffing-click).
-- This table is exclusively for campaign/orchestrator audit logs.

CREATE TABLE IF NOT EXISTS staffing_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES staffing_campaigns(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('availability', 'offer', 'system')),
  profile_id uuid REFERENCES profiles(id),
  role_code text,
  wave_number int,
  final_score int,
  score_breakdown jsonb,
  reasons jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staffing_campaign_events_campaign_phase
  ON staffing_campaign_events(campaign_id, phase);

CREATE INDEX IF NOT EXISTS staffing_campaign_events_profile_created
  ON staffing_campaign_events(profile_id, created_at);

ALTER TABLE staffing_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staffing_campaign_events_select_management"
  ON staffing_campaign_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staffing_campaigns sc
      JOIN profiles p ON p.id = auth.uid()
      WHERE sc.id = staffing_campaign_events.campaign_id
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = sc.department
          OR (sc.department = 'production' AND p.department = 'logistics')
        )
    )
  );
