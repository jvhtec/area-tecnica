-- Migration: Add invoicing_company column to tours table
-- This allows tours to specify an invoicing company that will be inherited by tour date jobs

BEGIN;

-- Add invoicing_company column to tours table
ALTER TABLE tours
ADD COLUMN invoicing_company text CHECK (
  invoicing_company IS NULL OR 
  invoicing_company IN ('Production Sector', 'Sharecable', 'MFO')
);

-- Add index for filtering tours by invoicing company
CREATE INDEX idx_tours_invoicing_company ON tours(invoicing_company)
WHERE invoicing_company IS NOT NULL;

COMMENT ON COLUMN tours.invoicing_company IS
  'Invoicing company for the tour. Tour date jobs will inherit this value when created.';

COMMIT;
