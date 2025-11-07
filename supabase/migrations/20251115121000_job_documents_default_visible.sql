-- Ensure existing job documents remain visible to technicians and default
-- new uploads to technician-visible unless explicitly hidden.

alter table if exists public.job_documents
  alter column visible_to_tech set default true;

update public.job_documents
set visible_to_tech = true
where visible_to_tech = false;
