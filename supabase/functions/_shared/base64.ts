// Safely convert an ArrayBuffer to a base64 string.
//
// `btoa(String.fromCharCode(...new Uint8Array(buf)))` throws a RangeError once
// the buffer exceeds the engine's argument limit (~65k–100k bytes), which is
// common for real images. Encoding in fixed-size chunks avoids that.

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32 KB per String.fromCharCode call
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
