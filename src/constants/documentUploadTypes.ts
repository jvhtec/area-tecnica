// File types accepted by every document/rider upload in the app. The public
// artist form's Edge Function keeps its own copy in
// supabase/functions/upload-public-artist-rider/fileRules.ts; a unit test
// (documentUploadValidation.test.ts) fails if the show-file lists drift.

export const GENERAL_DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "txt",
] as const;

/** L-Acoustics Soundvision / Network Manager and CAD / MVR exports. */
export const TECHNICAL_DOCUMENT_EXTENSIONS = [
  "xmlp",
  "xmlc",
  "xmls",
  "nwm",
  "dwg",
  "dfx",
  "dxf",
  "mvr",
] as const;

/**
 * Mixing-console and lighting-desk show files that riders and productions
 * send. Consoles that save a show as a folder (Avid VENUE, Hog 4, Allen & Heath
 * dLive, …) are shared zipped, hence `zip`.
 */
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

export const DOCUMENT_UPLOAD_EXTENSIONS: readonly string[] = [
  ...GENERAL_DOCUMENT_EXTENSIONS,
  ...TECHNICAL_DOCUMENT_EXTENSIONS,
  ...SHOW_FILE_EXTENSIONS,
];

/** Extensions made of several dot-separated parts, matched before the last one. */
export const COMPOUND_DOCUMENT_EXTENSIONS = DOCUMENT_UPLOAD_EXTENSIONS.filter((extension) =>
  extension.includes("."),
);

export const DOCUMENT_UPLOAD_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xml",
  "text/xml",
  // Show files and most technical formats have no registered MIME type.
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
];

/**
 * Splits a file name into its stem and its (lower-case) extension, treating a
 * known compound extension such as `show.gz` as one extension.
 */
export const splitDocumentFileName = (fileName: string): { stem: string; extension: string } => {
  const lowerName = fileName.toLowerCase();
  const compound = COMPOUND_DOCUMENT_EXTENSIONS.find((extension) => lowerName.endsWith(`.${extension}`));
  if (compound) {
    return { stem: fileName.slice(0, -(compound.length + 1)), extension: compound };
  }

  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return { stem: fileName, extension: "" };
  return { stem: fileName.slice(0, lastDot), extension: lowerName.slice(lastDot + 1) };
};
