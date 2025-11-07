// Utility helpers for WAHA (WhatsApp HTTP API)

// Normalizes a base URL string by ensuring scheme and trimming trailing slashes
export function normalizeBaseUrl(s: string): string {
  let b = (s || '').trim();
  if (!/^https?:\/\//i.test(b)) b = 'https://' + b;
  return b.replace(/\/+$/, '');
}

// Attempt to extract a hostname from a base url string
export function hostFromBase(base: string): string | null {
  try {
    const u = new URL(normalizeBaseUrl(base));
    return u.host || null;
  } catch (_) {
    return null;
  }
}

// Resolve WAHA API key for a given base url using env mapping.
// Priority:
//  1) WAHA_API_KEYS (JSON or comma list) host->key
//  2) WAHA_API_KEY (single fallback)
export function resolveWahaApiKeyForBase(base: string): string {
  const fallback = Deno.env.get('WAHA_API_KEY') || '';
  const raw = Deno.env.get('WAHA_API_KEYS') || '';
  if (!raw) return fallback;

  const host = hostFromBase(base);
  if (!host) return fallback;

  // Parse mapping; accept JSON or simple "host=key,host2=key2" form
  let map: Record<string, string> | null = null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      map = parsed as Record<string, string>;
    }
  } catch (_) {
    // Fallback: parse comma-separated pairs
    try {
      const out: Record<string, string> = {};
      raw.split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
        const sep = pair.includes('=') ? '=' : pair.includes(':') ? ':' : null;
        if (!sep) return;
        const [k, v] = pair.split(sep);
        if (k && v) out[k.trim()] = v.trim();
      });
      map = Object.keys(out).length ? out : null;
    } catch { /* ignore */ }
  }

  if (!map) return fallback;

  // Try direct host match first
  if (map[host]) return map[host];

  // Also try matching by normalized base url (full string)
  const norm = normalizeBaseUrl(base);
  if (map[norm]) return map[norm];

  // And by hostname without subdomain (e.g., domain.tld)
  const parts = host.split('.');
  if (parts.length > 2) {
    const root = parts.slice(parts.length - 2).join('.');
    if (map[root]) return map[root];
  }

  return fallback;
}

