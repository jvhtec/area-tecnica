import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");
const blobDirFlagIndex = process.argv.indexOf("--blob-dir");
const blobDirInline = process.argv.find((argument) => argument.startsWith("--blob-dir="));
const blobDir = blobDirInline?.slice("--blob-dir=".length)
  || (blobDirFlagIndex >= 0 ? process.argv[blobDirFlagIndex + 1] : undefined);
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this utility.");
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = "job-documents";
const supportedMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maxBytes = 10 * 1024 * 1024;
const mimeForExtension = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const detectImageMimeType = (bytes) => {
  if (
    bytes.length >= 3
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return "image/jpeg";

  if (
    bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";

  if (
    bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";

  return undefined;
};

const localBlobFiles = new Map();
if (blobDir) {
  for (const filename of await readdir(blobDir)) {
    const extension = extname(filename).toLowerCase();
    const mimeType = mimeForExtension.get(extension);
    if (!mimeType) continue;
    const imageId = filename.slice(0, -extension.length).toLowerCase();
    if (!localBlobFiles.has(imageId)) {
      localBlobFiles.set(imageId, { filename, mimeType });
    }
  }
}

const { data: rows, error } = await client
  .from("hoja_de_ruta_images")
  .select("id,image_path,image_type,hoja_de_ruta!hoja_de_ruta_images_hoja_de_ruta_id_fkey!inner(job_id)")
  .or("image_path.like.blob:%,image_path.like.data:%")
  .order("id");

if (error) throw error;

const summary = { data: 0, blob: 0, reuploadReady: 0, migrated: 0, skipped: 0, failed: 0 };

for (const row of rows || []) {
  const isBlobPath = row.image_path.startsWith("blob:");
  let bytes;
  let mimeType;
  let extension;

  if (isBlobPath) {
    summary.blob += 1;
    const localFile = localBlobFiles.get(row.id.toLowerCase());
    if (!localFile) {
      summary.skipped += 1;
      console.warn(`[reupload-required] image=${row.id} expected-file=${row.id}.(jpg|jpeg|png|webp)`);
      continue;
    }
    bytes = await readFile(join(blobDir, localFile.filename));
    mimeType = localFile.mimeType;
    summary.reuploadReady += 1;
  } else {
    summary.data += 1;
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(row.image_path);
    mimeType = match?.[1].toLowerCase();
    extension = mimeType ? supportedMimeTypes.get(mimeType) : undefined;
    if (!match || !mimeType || !extension) {
      summary.skipped += 1;
      console.warn(`[unsupported-data-uri] image=${row.id}`);
      continue;
    }
    bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  }

  if (bytes.length === 0 || bytes.length > maxBytes) {
    summary.skipped += 1;
    console.warn(`[invalid-size] image=${row.id} bytes=${bytes.length}`);
    continue;
  }

  const detectedMimeType = detectImageMimeType(bytes);
  if (!detectedMimeType || detectedMimeType !== mimeType) {
    summary.skipped += 1;
    console.warn(`[invalid-image-content] image=${row.id}`);
    continue;
  }
  extension = supportedMimeTypes.get(detectedMimeType);

  const jobId = row.hoja_de_ruta?.job_id;
  if (!jobId) {
    summary.failed += 1;
    console.error(`[missing-job] image=${row.id}`);
    continue;
  }

  const digest = createHash("sha256").update(bytes).digest("hex");
  const storagePath = `hojas-de-ruta/${jobId}/legacy/${row.id}-${digest.slice(0, 16)}.${extension}`;
  if (!apply) {
    console.log(`[dry-run] image=${row.id} bytes=${bytes.length} path=${storagePath}`);
    continue;
  }

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) {
    summary.failed += 1;
    console.error(`[upload-failed] image=${row.id} message=${uploadError.message}`);
    continue;
  }

  const { data: replaced, error: replaceError } = await client.rpc(
    "migrate_hoja_legacy_image_path",
    {
      p_image_id: row.id,
      p_expected_path: row.image_path,
      p_storage_path: storagePath,
    },
  );
  if (replaceError || !replaced) {
    summary.failed += 1;
    console.error(`[row-update-failed] image=${row.id} message=${replaceError?.message || "source changed"}`);
    continue;
  }

  summary.migrated += 1;
  console.log(`[migrated] image=${row.id} path=${storagePath}`);
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary }, null, 2));
if (summary.failed > 0) process.exitCode = 1;
