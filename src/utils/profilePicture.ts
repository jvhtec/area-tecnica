import { supabase } from "@/lib/supabase";

const BUCKET_NAME = 'profile-pictures';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

export interface UploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Upload a profile picture for the current user
 * @param file - The image file to upload
 * @param userId - The user's ID
 * @returns UploadResult with url or error
 */
export async function uploadProfilePicture(file: File, userId: string): Promise<UploadResult> {
  try {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return { url: null, error: 'File size exceeds 5MB limit' };
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { url: null, error: 'Invalid file type. Please use JPEG, PNG, WebP, or HEIC' };
    }

    // Generate file path: userId/profile.ext
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `${userId}/profile.${fileExt}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { url: null, error: uploadError.message };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Update profile with new picture URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: publicUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return { url: null, error: 'Failed to update profile' };
    }

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { url: null, error: 'An unexpected error occurred' };
  }
}

/**
 * Delete the profile picture for the current user
 * @param userId - The user's ID
 * @returns boolean indicating success
 */
export async function deleteProfilePicture(userId: string): Promise<boolean> {
  try {
    // List all files in the user's folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);

    if (listError || !files || files.length === 0) {
      return false;
    }

    // Delete all files in the user's folder
    const filePaths = files.map(file => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return false;
    }

    // Update profile to remove picture URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_picture_url: null })
      .eq('id', userId);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error:', error);
    return false;
  }
}

/**
 * Get the public URL for a user's profile picture
 * @param filePath - The storage file path or full URL
 * @returns The public URL or null
 */
export function getProfilePictureUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;

  // If it's already a full URL, return it
  if (filePath.startsWith('http')) {
    return filePath;
  }

  // Otherwise generate the public URL from the path
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return publicUrl;
}
