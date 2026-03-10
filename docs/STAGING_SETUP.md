# Staging Environment Setup (Cloudflare + Supabase)

This project uses:
- `dev` branch for active development
- Cloudflare Pages `Preview` deployments for staging validation
- A dedicated Supabase staging project (recommended) to avoid touching production data

## 1. Create/Use a Supabase Staging Project

In Supabase, create a separate project for staging and note:
- `SUPABASE_STAGING_PROJECT_REF`
- Staging Project URL
- Staging anon/public key

Keep production and staging refs different.

## 2. Local App Against Staging Supabase

```bash
cp .env.staging.example .env.staging.local
# fill values from staging project
npm run dev:staging
```

`dev:staging` runs Vite with `--mode staging`, so it loads `.env.staging.local`.

## 3. Supabase CLI Targeting Staging

Authenticate once:

```bash
npx supabase login
```

Set your staging project ref in the shell:

```bash
export SUPABASE_STAGING_PROJECT_REF="your-staging-project-ref"
```

Use staging-safe scripts:

```bash
npm run supabase:whoami
npm run supabase:link:staging
npm run supabase:db:push:staging
```

Deploy edge functions to staging:

```bash
# all functions
npm run supabase:functions:deploy:staging -- --all

# or one function
npm run supabase:functions:deploy:staging -- send-timesheet-reminder
```

Set function secrets on staging (example):

```bash
npx supabase secrets set \
  SUPABASE_URL="https://your-staging-project-ref.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="your-staging-service-role-key" \
  --project-ref "$SUPABASE_STAGING_PROJECT_REF"
```

## 4. Cloudflare Pages Mapping

Use environment variables in Cloudflare Pages:

- `Production` environment -> production Supabase values
- `Preview` environment -> staging Supabase values

Required vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_ENABLE_ACTIVITY_PUSH_FALLBACK`

This ensures every branch preview deploy reads/writes staging data only.

## 5. Verification Checklist

1. `npm run dev:staging` starts without missing env errors.
2. Browser network calls go to `https://<staging-ref>.supabase.co`.
3. `npm run supabase:db:push:staging` succeeds.
4. At least one edge function deployed to staging responds as expected.
5. A Cloudflare Preview URL uses staging Supabase (check API host in browser devtools).

## 6. Safe Rollout Pattern

1. Build and test on local staging mode.
2. Push to `dev` and validate Cloudflare Preview.
3. Promote only after staging checks pass.
