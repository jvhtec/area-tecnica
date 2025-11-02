-- Add description column to transport_requests table
-- This allows management to specify the reason/context for each transport request
-- Examples: "Subrental pickup from XYZ Rental", "Return equipment to ABC Rent"

ALTER TABLE public.transport_requests
ADD COLUMN IF NOT EXISTS description text NULL;

COMMENT ON COLUMN public.transport_requests.description IS 'Description or reason for the transport request (e.g., "Subrental pickup", "Return to vendor")';
