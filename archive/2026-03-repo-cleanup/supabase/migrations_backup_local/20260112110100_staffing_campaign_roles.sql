-- Create staffing_campaign_roles table for per-role progress tracking
CREATE TABLE IF NOT EXISTS staffing_campaign_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES staffing_campaigns(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  assigned_count int NOT NULL DEFAULT 0,
  pending_availability int NOT NULL DEFAULT 0,
  confirmed_availability int NOT NULL DEFAULT 0,
  pending_offers int NOT NULL DEFAULT 0,
  accepted_offers int NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'idle' CHECK (stage IN ('idle', 'availability', 'offer', 'filled', 'escalating')),
  wave_number int DEFAULT 0,
  last_wave_at timestamptz,
  availability_cutoff timestamptz,
  offer_cutoff timestamptz,
  updated_at timestamptz DEFAULT now(),

  UNIQUE(campaign_id, role_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS staffing_campaign_roles_campaign_stage
  ON staffing_campaign_roles(campaign_id, stage);

-- Enable RLS (inherits campaign permissions via foreign key)
ALTER TABLE staffing_campaign_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staffing_campaign_roles_select_management"
  ON staffing_campaign_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staffing_campaigns sc
      JOIN profiles p ON p.id = auth.uid()
      WHERE sc.id = staffing_campaign_roles.campaign_id
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = sc.department
          OR (sc.department = 'production' AND p.department = 'logistics')
        )
    )
  );

CREATE POLICY "staffing_campaign_roles_write_management"
  ON staffing_campaign_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM staffing_campaigns sc
      JOIN profiles p ON p.id = auth.uid()
      WHERE sc.id = staffing_campaign_roles.campaign_id
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = sc.department
          OR (sc.department = 'production' AND p.department = 'logistics')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staffing_campaigns sc
      JOIN profiles p ON p.id = auth.uid()
      WHERE sc.id = staffing_campaign_roles.campaign_id
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = sc.department
          OR (sc.department = 'production' AND p.department = 'logistics')
        )
    )
  );
