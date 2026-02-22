create or replace function public.sync_artist_mic_fields_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mic_kit text;
begin
  v_mic_kit := nullif(trim(coalesce(new.form_data->>'mic_kit', '')), '');

  update public.festival_artists
  set
    mic_kit = case
      when v_mic_kit in ('festival', 'band', 'mixed') then v_mic_kit
      else festival_artists.mic_kit
    end,
    wired_mics = coalesce(
      nullif(new.form_data->'wired_mics', 'null'::jsonb),
      festival_artists.wired_mics,
      '[]'::jsonb
    ),
    updated_at = timezone('utc', now())
  where id = new.artist_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_artist_mic_fields_from_submission
  on public.festival_artist_form_submissions;

create trigger trg_sync_artist_mic_fields_from_submission
after insert on public.festival_artist_form_submissions
for each row
execute function public.sync_artist_mic_fields_from_submission();
