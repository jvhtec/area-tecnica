-- Track riders that were copied from another festival/date so the UI can flag
-- them as "outdated" (a stale rider that should ideally be refreshed) instead of
-- "missing", and let coordinators dismiss that warning per artist.
ALTER TABLE public.festival_artists
  ADD COLUMN IF NOT EXISTS rider_copied_from_date date,
  ADD COLUMN IF NOT EXISTS rider_outdated_dismissed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.festival_artists.rider_copied_from_date IS
  'Source show date this artist (and its rider/specs) was copied from; non-null marks the rider as potentially outdated.';
COMMENT ON COLUMN public.festival_artists.rider_outdated_dismissed IS
  'When true, a coordinator has acknowledged/dismissed the outdated-rider warning for this copied artist.';
