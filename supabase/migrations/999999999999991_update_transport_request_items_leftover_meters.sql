-- Switch leftover space to meters instead of percent
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema='public' and table_name='transport_request_items' and column_name='leftover_space_percent'
  ) then
    alter table public.transport_request_items rename column leftover_space_percent to leftover_space_meters;
  end if;
end $$;

alter table public.transport_request_items 
  alter column leftover_space_meters type numeric(8,2) using leftover_space_meters::numeric;

-- Ensure non-negative constraint
alter table public.transport_request_items 
  add constraint transport_request_items_leftover_nonneg check (leftover_space_meters is null or leftover_space_meters >= 0);

