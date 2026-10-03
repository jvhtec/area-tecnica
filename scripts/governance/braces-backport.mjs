import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, ftruncateSync, fsyncSync, lstatSync, openSync, readFileSync, writeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const patchPath = fileURLToPath(new URL('../../patches/braces-3.0.3-depth.json', import.meta.url));
export const backport = JSON.parse(readFileSync(patchPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function regular(path) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const before = fstatSync(fd);
    if (!before.isFile()) throw new Error('Backport requires regular installed files');
    const bytes = readFileSync(fd), after = fstatSync(fd), named = lstatSync(path);
    if (named.isSymbolicLink() || before.dev !== named.dev || before.ino !== named.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error('Installed backport file changed while reading');
    return bytes;
  } finally { closeSync(fd); }
}

function writeReviewed(path, text, expected) {
  // Open without truncation and validate the descriptor before modifying it.
  const fd = openSync(path, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = fstatSync(fd), named = lstatSync(path);
    if (!info.isFile() || named.isSymbolicLink() || info.dev !== named.dev || info.ino !== named.ino || hash(readFileSync(fd)) !== expected) throw new Error('Installed source changed before backport write');
    const bytes = Buffer.from(text);
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset, offset);
    ftruncateSync(fd, bytes.length);
    fsyncSync(fd);
    const final = lstatSync(path);
    if (final.isSymbolicLink() || final.dev !== info.dev || final.ino !== info.ino) throw new Error('Installed source path changed during backport write');
  } finally { closeSync(fd); }
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
    writes.push({ path, text, expected: digest });
  }
  for (const { path, text, expected } of writes) writeReviewed(path, text, expected);
  verifyInstalledBackport(root);
  return true;
}
