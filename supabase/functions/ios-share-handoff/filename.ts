// Pure filename helpers for ios-share-handoff, kept free of Deno/Supabase
// imports so they can be unit tested with Vitest.

/** True for control characters and the path separators `/` and `\`. */
export function hasUnsafeFileNameCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || code === 47 || code === 92;
  });
}

/** Whether `value` can be stored as a display filename unchanged. */
export function isValidFileName(value: string): boolean {
  return !!value && value.length <= 255 && value !== "." && value !== ".." && !hasUnsafeFileNameCharacter(value);
}

/**
 * Outlook may hand over names with separators or control characters. Replace
 * each with `_` (never double-decoding), trim, and cap at 255 characters.
 */
export function sanitizeFileName(value: string): string {
  const replaced = [...value.normalize("NFC").trim()]
    .map((character) => (hasUnsafeFileNameCharacter(character) ? "_" : character))
    .join("");
  return replaced.slice(0, 255).trim();
}
