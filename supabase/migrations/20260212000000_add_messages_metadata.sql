-- Add metadata field to messages table to support structured message types
-- This allows messages to carry additional structured data like vacation_request_id for SoundVision access requests

DO $$ 
BEGIN
  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN metadata jsonb;
    COMMENT ON COLUMN public.messages.metadata IS 'Structured data for special message types (e.g., vacation_request_id for SoundVision access requests)';
  END IF;
END $$;
