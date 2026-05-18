-- Let the guest-link RPCs resolve pgcrypto from Supabase's extensions schema.
-- The original functions intentionally pin search_path for security, but
-- Supabase installs pgcrypto in extensions on the linked project.

alter function public.create_tour_guest_link(uuid, text, jsonb, timestamptz)
  set search_path = public, extensions;

alter function public.get_tour_guest_payload(text)
  set search_path = public, extensions;
