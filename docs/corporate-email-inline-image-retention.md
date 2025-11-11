# Corporate email inline image retention

Inline images uploaded through the corporate email composer are stored temporarily in the public Supabase storage bucket `corporate-emails-temp` under the `temp/` prefix. The sending flow now keeps these assets available after delivery so recipients can continue to view the email content until the retention window expires.

## Retention policy

- **Default window:** 7 days (168 hours).
- **Configuration:** Override by setting the `CORPORATE_EMAIL_IMAGE_RETENTION_HOURS` environment variable on Supabase. Invalid or missing values fall back to the default.
- **Metadata tracking:** Each successful send records the storage object paths and retention deadline in the `corporate_email_logs.inline_image_paths` and `corporate_email_logs.inline_image_retention_until` columns. Failed sends that could not clean up immediately also persist the paths for the background job to retry.

## Cleanup process

1. Inline images are uploaded during send and referenced from the email body.
2. After a successful send, the files remain in `corporate-emails-temp/temp/` until their retention deadline.
3. A scheduled Edge Function, `cleanup-corporate-email-images`, should be invoked regularly via Supabase Cron (recommended: hourly or daily). The function:
   - Removes any inline images whose retention deadline has passed and updates their log entries with `inline_image_cleanup_completed_at`.
   - Extends the retention deadline for any paths that could not be removed so they can be retried on the next run.
   - Deletes orphaned files in the `corporate-emails-temp` bucket that are older than the retention window and no longer tracked by `corporate_email_logs`.

## Operator guidance

- **Where assets live:** `Storage > corporate-emails-temp > temp/`
- **How long they persist:** Retained for the configured retention window (default 7 days) unless the cleanup job is delayed.
- **Manual intervention:** If files must be purged immediately, remove them from the storage bucket and clear the corresponding `inline_image_paths` in `corporate_email_logs` to prevent the cron job from reprocessing them.
- **Monitoring:** Review the `cleanup-corporate-email-images` function logs for errors. Any entries left in `inline_image_paths` after cleanup attempts indicate files the job could not delete (e.g., permission issues) and may require manual attention.
