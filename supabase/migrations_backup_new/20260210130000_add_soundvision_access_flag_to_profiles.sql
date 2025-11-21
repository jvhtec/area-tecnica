alter table public.profiles
  add column if not exists soundvision_access_enabled boolean default false;
