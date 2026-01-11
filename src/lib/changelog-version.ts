const SEMVER_3_RE = /^(?:v)?(\d+)\.(\d+)\.(\d+)(.*)$/i;
const SEMVER_2_RE = /^(?:v)?(\d+)\.(\d+)(.*)$/i;

const stripLeadingV = (version: string) => version.replace(/^v/i, '');

export function incrementChangelogVersion(previousVersion: string): string | null {
  const trimmed = previousVersion.trim();
  if (!trimmed) return null;

  const match3 = trimmed.match(SEMVER_3_RE);
  if (match3) {
    const major = Number(match3[1]);
    const minor = Number(match3[2]);
    const patch = Number(match3[3]);
    const suffix = match3[4] ?? '';

    if (![major, minor, patch].every(Number.isInteger)) return null;
    if ([major, minor, patch].some((n) => n < 0)) return null;

    return `${major}.${minor}.${patch + 1}${suffix}`;
  }

  const match2 = trimmed.match(SEMVER_2_RE);
  if (match2) {
    const major = Number(match2[1]);
    const minor = Number(match2[2]);
    const suffix = match2[3] ?? '';

    if (![major, minor].every(Number.isInteger)) return null;
    if ([major, minor].some((n) => n < 0)) return null;

    return `${major}.${minor}.1${suffix}`;
  }

  return null;
}

export function getChangelogVersionAutofill(
  previousVersion: string | null | undefined,
  fallbackVersion = '1.0.0'
): string {
  if (previousVersion) {
    const incremented = incrementChangelogVersion(previousVersion);
    if (incremented) return stripLeadingV(incremented);
  }

  const normalizedFallback = stripLeadingV(String(fallbackVersion ?? '').trim());
  return normalizedFallback || '1.0.0';
}

