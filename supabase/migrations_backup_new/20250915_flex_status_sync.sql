-- Add current_status column to flex_folders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'flex_folders' AND column_name = 'current_status'
            ) THEN
                ALTER TABLE public.flex_folders
                      ADD COLUMN current_status text CHECK (current_status IN ('tentativa','confirmado','cancelado'));
                        END IF;
                        END$$;

                        -- Create flex_status_log table for auditing status syncs
                        CREATE TABLE IF NOT EXISTS public.flex_status_log (
                          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                            folder_id uuid NOT NULL REFERENCES public.flex_folders(id) ON DELETE CASCADE,
                              previous_status text,
                                new_status text NOT NULL,
                                  action_type text DEFAULT 'api', -- api | scheduled | manual
                                    processed_by uuid NULL REFERENCES public.profiles(id),
                                      processed_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
                                        success boolean NOT NULL DEFAULT false,
                                          flex_response jsonb,
                                            error text
                                            );

                                            -- Helpful indexes
                                            CREATE INDEX IF NOT EXISTS flex_status_log_folder_id_idx ON public.flex_status_log(folder_id);
                                            CREATE INDEX IF NOT EXISTS flex_status_log_processed_at_idx ON public.flex_status_log(processed_at);
                                            CREATE INDEX IF NOT EXISTS flex_status_log_success_idx ON public.flex_status_log(success);

                                            