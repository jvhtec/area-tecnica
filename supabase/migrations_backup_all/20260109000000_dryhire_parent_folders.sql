-- Create table for storing dryhire parent folder IDs by year/department/month
CREATE TABLE dryhire_parent_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('sound', 'lights')),
  month TEXT NOT NULL CHECK (month IN ('01','02','03','04','05','06','07','08','09','10','11','12')),
  element_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, department, month)
);

-- Enable RLS
ALTER TABLE dryhire_parent_folders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON dryhire_parent_folders
  FOR SELECT TO authenticated USING (true);

-- Allow management/admin to insert/update/delete
CREATE POLICY "Allow management write" ON dryhire_parent_folders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Seed with existing 2025 data
INSERT INTO dryhire_parent_folders (year, department, month, element_id) VALUES
  -- Sound 2025
  (2025, 'sound', '01', '43b1f259-420e-4d12-b76d-1675ce6ddbfd'),
  (2025, 'sound', '02', '6d21b607-7c3a-43fe-bdb4-75a77a8ac4fa'),
  (2025, 'sound', '03', 'b8f1c60a-8fa2-44a5-ac83-40012e73f639'),
  (2025, 'sound', '04', '68d9ff6c-8313-4ff9-844d-47873d958b9b'),
  (2025, 'sound', '05', 'a19204e0-4b8c-4f2d-a86b-a07fa189f44c'),
  (2025, 'sound', '06', '27229f82-d759-4f7d-800a-1793e8c2b514'),
  (2025, 'sound', '07', '73b16d86-db32-4b91-bbe2-f11149db4aa5'),
  (2025, 'sound', '08', '8cdb98c5-8c32-4a14-bb3f-8a108cebb283'),
  (2025, 'sound', '09', '650960c8-3000-4e4a-8113-ec1cc5acb1c9'),
  (2025, 'sound', '10', '40ac2c72-3dbd-4804-998f-e42a6dd7dd33'),
  (2025, 'sound', '11', 'edaae406-25c2-4154-80ac-662bff9921c2'),
  (2025, 'sound', '12', 'bc758718-24c8-4045-bc65-6039b46fae0c'),
  -- Lights 2025
  (2025, 'lights', '01', '967f1612-fb01-4608-ad1d-0dc002ae9f8b'),
  (2025, 'lights', '02', '0c42a6b2-03dc-40fe-b30f-6d406329e8b0'),
  (2025, 'lights', '03', '9dc0d60b-6d0b-4fc7-be1a-85989d7df6d0'),
  (2025, 'lights', '04', 'af64eafc-f8e8-442c-84e1-9088f2a939eb'),
  (2025, 'lights', '05', '801ee08a-a868-42e1-8cf3-d34d33d881a5'),
  (2025, 'lights', '06', 'de57a801-7e5a-4831-afdb-0816522082a2'),
  (2025, 'lights', '07', '0e8e9cf1-9ec2-4522-a46e-d3f60bc7816a'),
  (2025, 'lights', '08', '86cc8f06-6286-4825-bfb8-cfc3cd614c82'),
  (2025, 'lights', '09', '4f0297a6-89cd-4654-b8c5-14c20cb9bc44'),
  (2025, 'lights', '10', '73a98ac6-6c11-4680-a854-186cc3d6901e'),
  (2025, 'lights', '11', '43b1f259-420e-4d12-b76d-1675ce6ddbfd'),
  (2025, 'lights', '12', 'faa70677-f8de-4161-8b2e-8846caa07ada');

-- Create index for common queries
CREATE INDEX idx_dryhire_parent_folders_lookup
  ON dryhire_parent_folders (year, department, month);
