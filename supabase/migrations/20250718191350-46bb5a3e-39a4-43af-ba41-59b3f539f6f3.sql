-- Add custom tour folder structure field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN custom_tour_folder_structure jsonb DEFAULT NULL;

-- Add comment to explain the tour structure
COMMENT ON COLUMN public.profiles.custom_tour_folder_structure IS 
'Stores custom folder structure specifically for tour local folder creation. Separate from regular job folder structure.';