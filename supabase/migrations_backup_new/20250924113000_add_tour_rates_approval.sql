-- Add per-tour rates approval fields
alter table public.tours
  add column if not exists rates_approved boolean not null default false,
  add column if not exists rates_approved_at timestamptz null,
  add column if not exists rates_approved_by uuid null;

-- Optional: reference to profiles.id (or auth.users) if desired
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tours_rates_approved_by_fkey'
  ) then
    alter table public.tours
      add constraint tours_rates_approved_by_fkey
      foreign key (rates_approved_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

comment on column public.tours.rates_approved is 'When true, technicians can see rates for this tour.';
comment on column public.tours.rates_approved_at is 'Timestamp when management approved rates for this tour.';
comment on column public.tours.rates_approved_by is 'Profile ID of the approver.';

