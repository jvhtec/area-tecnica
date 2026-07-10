export async function pushTargetFingerprint(
  prefix: "webpush" | "apns",
  value: string,
): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const shortHash = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}:${shortHash}`;
}

