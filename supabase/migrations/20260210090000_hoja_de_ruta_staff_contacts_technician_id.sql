-- Add technician_id links to hoja de ruta staff/contacts so we can keep hoja de ruta in sync
-- with staffing changes (job_assignments removals) without relying on name matching.

alter table public.hoja_de_ruta_staff
  add column if not exists technician_id uuid;

alter table public.hoja_de_ruta_contacts
  add column if not exists technician_id uuid;

create index if not exists idx_hoja_de_ruta_staff_technician_id
  on public.hoja_de_ruta_staff (technician_id);

create index if not exists idx_hoja_de_ruta_contacts_technician_id
  on public.hoja_de_ruta_contacts (technician_id);
