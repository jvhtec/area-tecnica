// Utilidades de validación de archivos SoundVision de L-Acoustics

// Tipos de archivos SoundVision de L-Acoustics:
// .xmlp - Archivo de proyecto (proyecto SoundVision completo)
// .xmls - Archivo de escena (contexto de recinto/geometría)
// .xmlc - Archivo de configuración (exportaciones como posiciones de altavoces)
// .nwm - Archivo de modelo NWM usado como referencia técnica
// .dwg/.dxf/.dfx - Planos CAD usados como referencia técnica
// .mvr - My Virtual Rig (formato GDTF, contenedor ZIP con datos 3D de escenario)
export const ALLOWED_FILE_TYPES = ['.xmlp', '.xmls', '.xmlc', '.nwm', '.dwg', '.dxf', '.dfx', '.mvr'];
export const ALLOWED_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/octet-stream', // Some systems may report XML files as octet-stream
  'application/acad',
  'application/x-acad',
  'application/autocad_dwg',
  'application/dwg',
  'application/x-dwg',
  'image/vnd.dwg',
  'application/dxf',
  'application/x-dxf',
  'application/vnd.dxf',
  'image/vnd.dxf',
  'drawing/x-dxf',
  'application/zip', // MVR files are ZIP containers
  'application/x-zip-compressed',
  'application/x-mvr',
];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateFile = (file: File): FileValidationResult => {
  // Comprobar el tamaño del archivo
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `El tamaño del archivo supera el límite de 100 MB (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    };
  }

  // Comprobar la extensión del archivo
  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || !ALLOWED_FILE_TYPES.includes(extension)) {
    return {
      valid: false,
      error: `Tipo de archivo no válido. Tipos permitidos: ${ALLOWED_FILE_TYPES.join(', ')}`,
    };
  }

  // Comprobar el tipo MIME (si está disponible)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Tipo MIME no válido: ${file.type}`,
    };
  }

  return { valid: true };
};

export const sanitizeFileName = (fileName: string): string => {
  // Eliminar intentos de recorridos de ruta
  const sanitized = fileName
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  return sanitized;
};

export const generateStoragePath = (venueId: string, fileName: string): string => {
  const timestamp = Date.now();
  const sanitizedName = sanitizeFileName(fileName);
  return `${venueId}/${timestamp}_${sanitizedName}`;
};
