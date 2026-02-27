alter table public.festival_artists
  add column if not exists stage_plot_file_path text,
  add column if not exists stage_plot_file_name text,
  add column if not exists stage_plot_file_type text,
  add column if not exists stage_plot_uploaded_at timestamptz;

comment on column public.festival_artists.stage_plot_file_path is
  'Relative storage path in festival_artist_files bucket for the artist stage plot image.';

comment on column public.festival_artists.stage_plot_file_name is
  'Original uploaded filename for the artist stage plot image.';

comment on column public.festival_artists.stage_plot_file_type is
  'MIME type of the uploaded artist stage plot image.';

comment on column public.festival_artists.stage_plot_uploaded_at is
  'Timestamp for the latest stage plot upload linked to this artist.';
