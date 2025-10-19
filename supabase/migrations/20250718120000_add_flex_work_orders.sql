-- Create enum for work order item sources if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'flex_work_order_item_source'
  ) THEN
    CREATE TYPE public.flex_work_order_item_source AS ENUM ('role', 'extra');
  END IF;
END
$$;

-- Main work orders table
CREATE TABLE IF NOT EXISTS public.flex_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flex_vendor_id text NOT NULL,
  flex_element_id text NOT NULL,
  flex_document_id text NOT NULL,
  folder_element_id text NOT NULL,
  document_number text,
  document_name text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (job_id, technician_id),
  UNIQUE (flex_document_id)
);

-- Work order line items table
CREATE TABLE IF NOT EXISTS public.flex_work_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.flex_work_orders(id) ON DELETE CASCADE,
  source_type public.flex_work_order_item_source NOT NULL,
  job_assignment_id uuid REFERENCES public.job_assignments(id) ON DELETE CASCADE,
  job_role text,
  role_department text,
  extra_type public.job_extra_type,
  flex_resource_id text NOT NULL,
  flex_line_item_id text NOT NULL,
  quantity numeric DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (work_order_id, job_assignment_id, job_role),
  UNIQUE (work_order_id, extra_type)
);

ALTER TABLE public.flex_work_order_items
  ADD CONSTRAINT flex_work_order_items_source_requirements
  CHECK (
    (source_type = 'role' AND job_assignment_id IS NOT NULL AND job_role IS NOT NULL AND extra_type IS NULL)
    OR (source_type = 'extra' AND extra_type IS NOT NULL)
  );

-- Ensure role rows always carry department metadata
ALTER TABLE public.flex_work_order_items
  ADD CONSTRAINT flex_work_order_items_role_department_check
  CHECK (
    source_type <> 'role' OR role_department IS NOT NULL
  );

-- Enable Row Level Security
ALTER TABLE public.flex_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_work_order_items ENABLE ROW LEVEL SECURITY;

-- Policies: management/admin only
CREATE POLICY flex_work_orders_management
  ON public.flex_work_orders
  FOR ALL
  USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

CREATE POLICY flex_work_order_items_management
  ON public.flex_work_order_items
  FOR ALL
  USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]))
  WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'management'::text]));

-- Helpful indexes
CREATE INDEX flex_work_orders_job_id_idx
  ON public.flex_work_orders (job_id);

CREATE INDEX flex_work_orders_technician_idx
  ON public.flex_work_orders (technician_id);

CREATE INDEX flex_work_order_items_work_order_idx
  ON public.flex_work_order_items (work_order_id);

CREATE INDEX flex_work_order_items_assignment_idx
  ON public.flex_work_order_items (job_assignment_id)
  WHERE job_assignment_id IS NOT NULL;

CREATE UNIQUE INDEX flex_work_order_items_line_item_idx
  ON public.flex_work_order_items (flex_line_item_id);

-- Updated at triggers
DROP TRIGGER IF EXISTS trg_flex_work_orders_set_updated_at ON public.flex_work_orders;
CREATE TRIGGER trg_flex_work_orders_set_updated_at
  BEFORE UPDATE ON public.flex_work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_flex_work_order_items_set_updated_at ON public.flex_work_order_items;
CREATE TRIGGER trg_flex_work_order_items_set_updated_at
  BEFORE UPDATE ON public.flex_work_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
