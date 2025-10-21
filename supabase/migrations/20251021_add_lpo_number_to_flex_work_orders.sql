-- Add LPO/document number column for exposing Flex numbers in UI
alter table if exists public.flex_work_orders
  add column if not exists lpo_number text;

create index if not exists idx_flex_work_orders_lpo_number on public.flex_work_orders(lpo_number);

comment on column public.flex_work_orders.lpo_number is 'Flex-assigned document number for the per-tech LPO/work order';

