ALTER TABLE public.profiles
ADD COLUMN warehouse_duty_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.warehouse_duty_exempt IS
  'When true, this house tech is excluded from warehouse-duty population queries such as the Personal agenda and warehouse summaries.';
