import { readFile, writeFile } from "node:fs/promises";
import { transformWithEsbuild } from "vite";

const buildTimestamp = `${Math.floor(Date.now() / 1000)}`;
const swFile = "dist/sw.js";
const indexFile = "dist/index.html";
const placeholder = "__BUILD_TIMESTAMP__";
const supabasePreconnectPlaceholder = "<!-- __SUPABASE_PRECONNECT__ -->";

const isMissingFileError = (error) =>
  error && typeof error === "object" && "code" in error && error.code === "ENOENT";

const getSupabasePreconnectTags = () => {
  const rawUrl = process.env.VITE_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return [
      `<link rel="preconnect" href="${url.origin}" crossorigin />`,
      `<link rel="dns-prefetch" href="${url.origin}" />`,
    ].join("\n  ");
  } catch {
    return "";
  }
};

let currentContents;
try {
  currentContents = await readFile(swFile, "utf8");
} catch (error) {
  if (isMissingFileError(error)) {
    console.error(`Warning: service worker file not found at ${swFile}`);
    process.exit(1);
  }
  throw error;
}

if (!currentContents.includes(placeholder)) {
  console.error(`Warning: placeholder ${placeholder} not found in ${swFile}`);
  process.exit(1);
}

const nextContents = currentContents.replaceAll(placeholder, buildTimestamp);
const { code: minifiedServiceWorker } = await transformWithEsbuild(nextContents, swFile, {
  drop: ["console"],
  loader: "js",
  minify: true,
  target: "es2020",
});

await writeFile(swFile, minifiedServiceWorker, "utf8");

console.log(`Injected build timestamp and minified service worker: ${buildTimestamp}`);

try {
  const indexContents = await readFile(indexFile, "utf8");
  if (indexContents.includes(supabasePreconnectPlaceholder)) {
    const supabasePreconnectTags = getSupabasePreconnectTags();
    await writeFile(
      indexFile,
      indexContents.replace(supabasePreconnectPlaceholder, supabasePreconnectTags),
      "utf8",
    );
    if (supabasePreconnectTags) {
      console.log("Injected Supabase preconnect tags into index.html");
    } else {
      console.log("Removed Supabase preconnect placeholder from index.html");
    }
  }
} catch (error) {
  if (!isMissingFileError(error)) {
    throw error;
  }
}
