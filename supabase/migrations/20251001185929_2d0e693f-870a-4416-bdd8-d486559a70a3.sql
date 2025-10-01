-- Add waha_endpoint column to profiles table for user-specific WAHA routing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS waha_endpoint text;

-- Set WAHA endpoints for the three authorized users
-- Arturo Serra
UPDATE public.profiles 
SET waha_endpoint = 'https://waha.sector-pro.work'
WHERE id = '2bdb1507-6ee4-483b-be56-c7a09338d6b1';

-- Javier Vadillo  
UPDATE public.profiles
SET waha_endpoint = 'https://waha2.sector-pro.work'
WHERE id = '3f320605-c05c-4dcc-b668-c0e01e2c4af9';

-- Carlos Valero
UPDATE public.profiles
SET waha_endpoint = 'https://waha3.sector-pro.work'
WHERE id = '4d1b7ec6-0657-496e-a759-c721916e0c09';