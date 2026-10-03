import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const patchPath = fileURLToPath(new URL('../../patches/braces-3.0.3-depth.json', import.meta.url));
export const backport = JSON.parse(readFileSync(patchPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function regular(path) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Backport requires regular installed files');
  return readFileSync(path);
}

function packageRoot(root) {
  const directory = join(resolve(root), 'node_modules', 'braces');
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Backport requires a regular installed package');
  const library = lstatSync(join(directory, 'lib'));
  if (!library.isDirectory() || library.isSymbolicLink()) throw new Error('Backport requires a regular library directory');
  const manifest = JSON.parse(regular(join(directory, 'package.json')));
  if (manifest.name !== 'braces' || manifest.version !== backport.version) throw new Error('Unreviewed braces version; update or retire the backport deliberately');
  for (const [file, expected] of Object.entries(backport.unchangedFiles)) {
    if (hash(regular(join(directory, file))) !== expected) throw new Error('Unreviewed braces entrypoint or unchanged library source');
  }
  return directory;
}

export function verifyInstalledBackport(root) {
  const directory = packageRoot(root);
  for (const [file, expected] of Object.entries(backport.files)) {
    if (hash(regular(join(directory, file))) !== expected.patchedSha256) throw new Error('Installed braces depth backport is missing or changed');
  }
  return true;
}

export function applyBackport(root) {
  let directory;
  try { directory = packageRoot(root); }
  catch (error) {
    if (error.code === 'ENOENT' && error.path === join(resolve(root), 'node_modules', 'braces')) return false;
    throw error;
  }
  const writes = [];
  // Validate every input before changing any file. Idempotence permits a
  // interrupted install to finish, while governance requires all patched bytes.
  for (const [file, expected] of Object.entries(backport.files)) {
    const path = join(directory, file), bytes = regular(path), digest = hash(bytes);
    if (digest === expected.patchedSha256) continue;
    if (digest !== expected.originalSha256) throw new Error('Unreviewed braces source; refusing to patch');
    let text = bytes.toString('utf8').replace(/\r\n/g, '\n');
    for (const { before, after } of expected.edits) {
      if (text.split(before).length !== 2) throw new Error('Security hunk does not uniquely match installed source');
      text = text.replace(before, () => after);
    }
    if (hash(Buffer.from(text)) !== expected.patchedSha256) throw new Error('Security backport output differs from reviewed bytes');
    writes.push({ path, text });
  }
  for (const { path, text } of writes) writeFileSync(path, text);
  verifyInstalledBackport(root);
  return true;
}
