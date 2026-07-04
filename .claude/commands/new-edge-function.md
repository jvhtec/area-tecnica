---
description: Scaffold a new Supabase Edge Function using the repo's createHttpHandler pattern and wire up the exposure-classification governance gate correctly from the start, instead of failing CI after the fact.
---

Create a new Edge Function for: $ARGUMENTS

1. **Create the directory**: `supabase/functions/<name>/index.ts`. Use Deno-only imports (`https://esm.sh/...` or `jsr:...`) — no Node APIs or npm imports.
2. **Use the shared HTTP wrapper**, don't hand-roll CORS/error handling:
   ```typescript
   import { createHttpHandler, readJsonObject, errorResponse } from "../_shared/http.ts";

   Deno.serve(createHttpHandler(async (req) => {
     const body = await readJsonObject(req);
     // ... handler logic
     return new Response(JSON.stringify({ ok: true }), {
       headers: { "Content-Type": "application/json" },
     });
   }, { allowedMethods: ["POST"] }));
   ```
   `governance:functions` (`scripts/governance/edge-function-baseline.json`) fails CI for new functions that don't call `createHttpHandler` — there's no "add to baseline" escape hatch for new functions, only for pre-existing legacy ones.
3. **Classify the function's exposure** in `scripts/governance/edge-function-exposure.json` — pick one `class` (see the `classes` block at the top of that file for definitions):
   - `public-token` — reachable with no session, protected by a token/signed link/shared secret. Must set `internalGuard` describing that guard.
   - `authenticated-user` — requires a valid Supabase user JWT, no extra role check.
   - `privileged-role` — requires a JWT + role/capability check (e.g. `requireAdminOrManagement`).
   - `service-only` — invoked by pg_cron/triggers/trusted server code with the service role. If `verifyJwt: false`, must implement `requireServiceRoleRequest`/`isServiceRoleRequest` and set `internalGuard`.
4. **Set `verify_jwt` in `supabase/config.toml`** to match the `verifyJwt` you declared in the manifest — `governance:exposure` fails if they disagree. Default (no `[functions.<name>]` block) resolves to `verify_jwt = true`.
5. **Verify locally**:
   ```bash
   npm run lint:functions
   npm run governance:functions
   npm run governance:exposure
   ```
6. **Update CLAUDE.md**'s "Supabase Edge Functions" category list with the new function name so the doc doesn't go stale again.
7. If the function sends email/WhatsApp, touches Flex, or handles staffing campaigns, check the equivalent existing function in that category first and match its patterns (secrets via `Deno.env`, error redaction via `_shared/http.ts`'s `redactSensitiveValues`, etc.) rather than inventing a new one.
