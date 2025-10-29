create type if not exists public.push_notification_recipient_type as enum (
  'management_user',
  'department',
  'broadcast',
  'natural'
);

create table if not exists public.push_notification_routes (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  recipient_type public.push_notification_recipient_type not null,
  target_id text null,
  include_natural_recipients boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.push_notification_routes is 'Configurable routing rules for push notification broadcasts per event.';
comment on column public.push_notification_routes.event_code is 'Event code (e.g. job.created) for the broadcast body.type.';
comment on column public.push_notification_routes.recipient_type is 'Routing target type for the event (management user, department, broadcast, or natural recipients).';
comment on column public.push_notification_routes.target_id is 'Optional identifier matching the recipient_type (e.g. profile UUID or department slug).';
comment on column public.push_notification_routes.include_natural_recipients is 'Whether to include the legacy event-specific recipients in addition to configured routes.';

create index if not exists push_notification_routes_event_idx on public.push_notification_routes (event_code);
