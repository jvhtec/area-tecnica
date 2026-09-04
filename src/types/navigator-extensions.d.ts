/**
 * Non-standard / not-yet-typed `Navigator` members the app feature-detects.
 *
 * Both are optional on purpose: the call sites must keep guarding them, since
 * neither is available in every browser we run in (iOS Safari, Android Chrome,
 * desktop Chromium).
 */
interface NavigatorUAData {
  readonly platform: string;
  readonly mobile: boolean;
  readonly brands: ReadonlyArray<{ brand: string; version: string }>;
}

interface Navigator {
  /** User-Agent Client Hints — Chromium only, not in TypeScript's DOM lib yet. */
  readonly userAgentData?: NavigatorUAData;
  /** Legacy iOS Safari flag: true when the page runs as an installed home-screen app. */
  readonly standalone?: boolean;
}
