do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname = 'push_notification_recipient_type'
      and e.enumlabel = 'assigned_technicians'
  ) then
    alter type public.push_notification_recipient_type add value 'assigned_technicians';
  end if;
end $$;

comment on type public.push_notification_recipient_type is 'Recipient type for push notification routing (includes management_user, department, broadcast, natural, assigned_technicians).';
