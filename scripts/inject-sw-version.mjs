import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const buildTimestamp = `${Math.floor(Date.now() / 1000)}`;
const swFile = "dist/sw.js";
const placeholder = "__BUILD_TIMESTAMP__";

if (!existsSync(swFile)) {
  console.error(`Warning: service worker file not found at ${swFile}`);
  process.exit(1);
}

const currentContents = await readFile(swFile, "utf8");

if (!currentContents.includes(placeholder)) {
  console.error(`Warning: placeholder ${placeholder} not found in ${swFile}`);
  process.exit(1);
}

const nextContents = currentContents.replaceAll(placeholder, buildTimestamp);

await writeFile(swFile, nextContents, "utf8");

console.log(`Injected build timestamp into service worker: ${buildTimestamp}`);
