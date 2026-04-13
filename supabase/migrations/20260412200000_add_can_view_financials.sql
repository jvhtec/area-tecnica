-- Add explicit can_view_financials permission flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_view_financials boolean NOT NULL DEFAULT false;

-- Auto-migrate existing users who currently have implicit financial access:
-- admins, management in payout departments, and logistics users
UPDATE public.profiles
SET can_view_financials = true
WHERE role = 'admin'
   OR (role = 'management' AND lower(
        translate(department, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')
      ) IN ('sound', 'lights', 'production', 'produccion', 'administrative', 'administracion'))
   OR role = 'logistics';
