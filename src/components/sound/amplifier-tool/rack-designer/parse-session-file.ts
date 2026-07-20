import type { NwmMap } from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import { supabase } from '@/integrations/supabase/client';

/** Reads a session file as base64 without the data-URL prefix. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/** Decrypts and normalizes an L-Acoustics NM/Soundvision session transiently. */
export async function parseLaSessionFile(file: File): Promise<NwmMap> {
  const base64 = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke('parse-la-session', {
    body: { file: base64, fileName: file.name },
  });
  if (error) throw error;

  const map = (data as { map?: NwmMap } | null)?.map;
  if (!map) throw new Error('No se pudo interpretar el archivo de L-Acoustics.');
  return map;
}
