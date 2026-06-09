-- User deletion follow-up:
-- PR #679 normalized the known profile/auth user references, but
-- tour_guest_links.created_by still referenced profiles(id) with the default
-- NO ACTION behavior. That blocks auth.admin.deleteUser() for users who created
-- guest links. Keep the guest link and clear the deleted creator reference.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_guest_links'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tour_guest_links
      DROP CONSTRAINT IF EXISTS tour_guest_links_created_by_fkey;

    ALTER TABLE public.tour_guest_links
      ALTER COLUMN created_by DROP NOT NULL;

    ALTER TABLE public.tour_guest_links
      ADD CONSTRAINT tour_guest_links_created_by_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;
