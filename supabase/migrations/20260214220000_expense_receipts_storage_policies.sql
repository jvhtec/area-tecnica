-- Migration: Add RLS policies for expense-receipts storage bucket
-- Description: Allow technicians to upload receipts for jobs they have expense permissions for

-- First, ensure the bucket exists (idempotent - won't fail if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Technicians can upload receipts for jobs with expense permissions" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can view their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Management can view all expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Technicians can delete their draft expense receipts" ON storage.objects;

-- Policy 1: Allow technicians to upload receipts for jobs they have active expense permissions for
CREATE POLICY "Technicians can upload receipts for jobs with expense permissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (
    -- Allow upload if user has any expense permission for the job
    -- Path format: job/{job_id}/{filename}
    EXISTS (
      SELECT 1 FROM expense_permissions ep
      WHERE ep.technician_id = auth.uid()
      AND ep.job_id::text = (string_to_array(name, '/'))[2]
      -- Optional: check if permission is currently active
      -- AND (ep.valid_from IS NULL OR ep.valid_from <= CURRENT_DATE)
      -- AND (ep.valid_to IS NULL OR ep.valid_to >= CURRENT_DATE)
    )
    -- Also allow management to upload
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'management')
    )
  )
);

-- Policy 2: Allow technicians to view their own receipts
CREATE POLICY "Technicians can view their own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    -- Allow if user has expense permission for this job
    EXISTS (
      SELECT 1 FROM expense_permissions ep
      WHERE ep.technician_id = auth.uid()
      AND ep.job_id::text = (string_to_array(name, '/'))[2]
    )
    -- Also allow if user owns an expense with this receipt path
    OR EXISTS (
      SELECT 1 FROM job_expenses je
      WHERE je.technician_id = auth.uid()
      AND je.receipt_path = name
    )
  )
);

-- Policy 3: Allow management to view all expense receipts
CREATE POLICY "Management can view all expense receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('admin', 'management', 'logistics')
  )
);

-- Policy 4: Allow technicians to delete receipts for draft expenses only
CREATE POLICY "Technicians can delete their draft expense receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (
    -- Allow delete if receipt belongs to a draft expense owned by user
    EXISTS (
      SELECT 1 FROM job_expenses je
      WHERE je.technician_id = auth.uid()
      AND je.receipt_path = name
      AND je.status = 'draft'
    )
    -- Or if management
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'management')
    )
  )
);

-- Comments cannot be added to storage policies via migrations due to permissions
-- Policy descriptions:
-- 1. "Technicians can upload receipts for jobs with expense permissions" - Allows technicians to upload receipts to expense-receipts bucket for jobs where they have expense_permissions records
-- 2. "Technicians can view their own receipts" - Allows technicians to view receipts for jobs they have permissions for or expenses they own
-- 3. "Management can view all expense receipts" - Allows management roles to view all expense receipts across all jobs
-- 4. "Technicians can delete their draft expense receipts" - Allows technicians to delete receipts only for draft expenses, prevents deletion of submitted/approved receipts
