# Security Audit Logging

This project now persists security-sensitive audit events through:

- `public.security_audit_log` for durable storage
- `supabase/functions/security-audit` for frontend-originated audit events
- direct backend logging in `get-secret` and `get-google-maps-key`

## What Gets Logged

The current audit trail covers:

- authentication success and failure from `src/hooks/useOptimizedAuth.tsx`
- password reset request success and failure
- password reset completion success and failure
- secret access through `supabase/functions/get-secret`
- Google Maps key access through `supabase/functions/get-google-maps-key`

Each row stores:

- `created_at`
- `user_id` when known
- `action`
- `resource`
- `severity`
- request-derived `ip_address`
- request-derived `user_agent`
- `metadata` with safe identifiers and outcomes

Secret material is never written to `metadata`.

## Access Model

- client code cannot insert directly into `public.security_audit_log`
- only the service role writes audit rows
- authenticated reads are limited to admin and management users through RLS

The `security-audit` edge function prefers the authenticated JWT user over any claimed `user_id` sent by the client.

## Event Naming

Stable action names currently in use:

- `auth_login`
- `auth_logout`
- `password_reset_request`
- `password_reset_complete`
- `secret_access`
- `google_maps_key_access`
- `suspicious_activity`

Resources identify the protected surface, for example:

- `authentication`
- `google_maps_api_key`
- `secret:OPENAI_API_KEY`

## Example Queries

Recent auth activity:

```sql
select created_at, user_id, action, severity, metadata
from public.security_audit_log
where resource = 'authentication'
order by created_at desc
limit 50;
```

Recent denied secret access:

```sql
select created_at, user_id, resource, metadata
from public.security_audit_log
where action = 'secret_access'
  and coalesce((metadata ->> 'success')::boolean, false) = false
order by created_at desc
limit 50;
```

Google Maps key access by role:

```sql
select created_at, user_id, metadata ->> 'role' as role, metadata ->> 'outcome' as outcome
from public.security_audit_log
where action = 'google_maps_key_access'
order by created_at desc
limit 50;
```
