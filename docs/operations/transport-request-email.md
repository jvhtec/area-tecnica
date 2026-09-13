# Transport request emails

New manual and subrental requests already broadcast `logistics.transport.requested` through the `push` Edge Function. This event also sends an email using the shared corporate template. The event must include the saved `request_id`; request details and the requester are read from the database, not from the broadcast payload.

Recipients are profiles in the `logistics` department with a valid email address. Addresses are normalized and deduplicated, and each recipient receives a separate message. Email delivery does not depend on push subscriptions, notification preferences or push routing overrides. The existing push audience remains unchanged.

The email includes the job, requester name and email, department, creation and required dates, movement type, priority, source, route, description, notes, requested vehicles and leftover space. Optional fields with no value are omitted rather than rendered as placeholders. `high` and `urgent` requests carry a coloured priority badge, and `urgent` requests are prefixed `[URGENTE]` in the subject. Numbers and dates are formatted for `es-ES`, dates use the job timezone falling back to Europe/Madrid, and vehicle labels match `getLogisticsTransportTypeLabel` in the app. Each message carries a plain-text alternative alongside the HTML part, and `replyTo` is set to the requester so Logistics can answer them directly. The action link opens the Logistics page.

## Authorization and retries

User callers must be the request creator and have an admin or management role. Authenticated internal service callers can notify for server-created requests. Closed requests, invalid IDs and requests older than 15 minutes are not emailed; this is a creation notification, not a historical resend endpoint.

The send is started at the top of the broadcast handler but only awaited at each response point, so it runs alongside push delivery instead of ahead of it: a slow or hung mail provider cannot delay or starve the push path, and no return path drops an in-flight send. Each request/address pair uses a deterministic UUID idempotency key. [Brevo's idempotency documentation](https://developers.brevo.com/docs/heterogenous-versions-batch-emails) specifies a 30-minute deduplication window, longer than the 15-minute creation window. A duplicate response is treated as already processed. Email failures do not block push delivery or roll back the saved request. Delivery results are included in the broadcast response under `email`.

Delivery is best effort. There is no persistent email queue or scheduled retry. Existing tour and truck-planner generation paths do not emit this broadcast and are outside this notification path. Editing or completing a request does not send a creation email.

## Deployment and verification

Deploy the updated `push` Edge Function using the normal release process. It uses the existing `BREVO_API_KEY` and `BREVO_FROM` secrets, plus the shared template's `COMPANY_LOGO_URL_W`, `AT_LOGO_URL` and `SUPABASE_URL` settings. No database migration is required.

Run `npm run lint:functions`, `npm run typecheck:functions` and the transport email tests under `supabase/functions/push/__tests__`. Unit tests mock the mail provider and do not send real emails. After deployment, verify the next real request produces the expected email and check the Edge Function result/logs if delivery fails.

Rollback by deploying `push` from the previous release; request data is unaffected.
