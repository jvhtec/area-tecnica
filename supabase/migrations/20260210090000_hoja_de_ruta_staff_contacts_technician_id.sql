-- Add technician_id links to hoja de ruta staff/contacts so we can keep hoja de ruta in sync
-- with staffing changes (job_assignments removals) without relying on name matching.

alter table public.hoja_de_ruta_staff
  add column if not exists technician_id uuid;

alter table public.hoja_de_ruta_contacts
  add column if not exists technician_id uuid;

-- Foreign keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hoja_de_ruta_staff_technician_id_profiles_id'
  ) THEN
    ALTER TABLE public.hoja_de_ruta_staff
      ADD CONSTRAINT fk_hoja_de_ruta_staff_technician_id_profiles_id
      FOREIGN KEY (technician_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_hoja_de_ruta_contacts_technician_id_profiles_id'
  ) THEN
    ALTER TABLE public.hoja_de_ruta_contacts
      ADD CONSTRAINT fk_hoja_de_ruta_contacts_technician_id_profiles_id
      FOREIGN KEY (technician_id)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists idx_hoja_de_ruta_staff_technician_id
  on public.hoja_de_ruta_staff (technician_id);

create index if not exists idx_hoja_de_ruta_contacts_technician_id
  on public.hoja_de_ruta_contacts (technician_id);
