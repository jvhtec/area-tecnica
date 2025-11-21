-- Add custom folder structure field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN custom_folder_structure jsonb DEFAULT NULL;

-- Add comment to explain the structure
COMMENT ON COLUMN public.profiles.custom_folder_structure IS 
'Stores custom folder structure for local folder creation. Can be array of strings or objects with name and subfolders properties.';