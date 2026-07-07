import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useImageUpload() {
  const [uploading, setUploading] = useState(false)

  const uploadImage = async (
    blob: Blob,
    sideOrFolder: 'front' | 'rear' | string,
    options?: { bucket?: string },
  ): Promise<string> => {
    setUploading(true)
    try {
      const uuid = crypto.randomUUID()
      const path = `${sideOrFolder}/${uuid}.jpg`
      const { error } = await supabase.storage
        .from(options?.bucket ?? 'rack-builder-device-images')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      return path
    } finally {
      setUploading(false)
    }
  }

  return { uploadImage, uploading }
}
