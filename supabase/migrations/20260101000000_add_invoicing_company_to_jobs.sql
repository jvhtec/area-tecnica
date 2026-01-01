-- Add invoicing_company enum and column to jobs table
-- This field tracks which company should receive invoices for the job

-- Create the enum type for invoicing companies
CREATE TYPE invoicing_company AS ENUM ('Production Sector', 'Sharecable', 'MFO');

-- Add the nullable column to jobs table
ALTER TABLE jobs ADD COLUMN invoicing_company invoicing_company DEFAULT NULL;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN jobs.invoicing_company IS 'The company to which technicians should invoice for this job. Nullable - only set when specific invoicing instructions are needed.';
