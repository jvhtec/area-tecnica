// Rider uploads accepted from the public artist form. Mirrors
// src/constants/documentUploadTypes.ts (the app uploaders); a unit test in
// src/utils/__tests__/documentUploadValidation.test.ts fails if they drift.

// Console and lighting-desk show files; folder-based shows are sent zipped.
export const SHOW_FILE_EXTENSIONS = [
  "clf", // Yamaha CL / QL
  "tff", // Yamaha TF
  "ses", // DiGiCo SD / Quantum session
  "scn", // Midas M32 / Behringer X32 scene
  "shw", // Midas M32 / Behringer X32 show, ChamSys MagicQ show
  "snp", // Midas M32 / Behringer X32 snippet
  "show", // grandMA3
  "show.gz", // grandMA2
  "esf", // ETC Eos
  "zip", // folder-based show files, zipped
] as const;

export const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "xmlp",
  "xmlc",
  "xmls",
  "nwm",
  "dwg",
  "dfx",
  "dxf",
  "mvr",
  ...SHOW_FILE_EXTENSIONS,
]);
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/xml",
  "text/xml",
  "application/octet-stream",
  "application/acad",
  "application/x-acad",
  "application/autocad_dwg",
  "application/dwg",
  "application/x-dwg",
  "image/vnd.dwg",
  "application/dxf",
  "application/x-dxf",
  "application/vnd.dxf",
  "image/vnd.dxf",
  "drawing/x-dxf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-mvr",
  "application/gzip",
  "application/x-gzip",
]);

const COMPOUND_EXTENSIONS = [...ALLOWED_EXTENSIONS].filter((extension) => extension.includes("."));

/** Lower-case extension, treating a known compound extension (`show.gz`) as one. */
export const getFileExtension = (fileName: string) => {
  const lowerName = fileName.toLowerCase();
  const compound = COMPOUND_EXTENSIONS.find((extension) => lowerName.endsWith(`.${extension}`));
  if (compound) return compound;
  const parts = lowerName.split(".");
  return parts.length < 2 ? "" : parts[parts.length - 1];
};
