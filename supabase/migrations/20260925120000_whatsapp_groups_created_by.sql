-- Record which manager created each job WhatsApp group. Only the WAHA session that created
-- a group can add participants to it, so syncing an existing group (e.g. adding a
-- department lead that was left out) must go through the creator's endpoint.

ALTER TABLE public.job_whatsapp_groups
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS job_whatsapp_groups_created_by_idx
  ON public.job_whatsapp_groups (created_by);

COMMENT ON COLUMN public.job_whatsapp_groups.created_by IS
'Manager whose WAHA session created the group. NULL for groups created before this was tracked; the create-whatsapp-group sync locates their owning session by probing.';

-- Backfill from the group-creation quota ledger: the ledger row is written just before the
-- group is created and persisted, so take the latest one for the job within 10 minutes.
UPDATE public.job_whatsapp_groups g
SET created_by = (
  SELECT a.actor_id
  FROM public.whatsapp_send_audit a
  WHERE a.kind = 'group_creation'
    AND a.job_id = g.job_id
    AND a.created_at <= g.created_at
    AND a.created_at > g.created_at - interval '10 minutes'
  ORDER BY a.created_at DESC
  LIMIT 1
)
WHERE g.created_by IS NULL;
