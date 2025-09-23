// Simple color utilities for contrast-aware text on colored backgrounds

// Parse a hex color like #RRGGBB or #RGB into { r, g, b }
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const s = hex.trim();
  const m = s.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Convert sRGB component (0-255) to linear RGB (0..1)
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// WCAG relative luminance
export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(l1: number, l2: number): number {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

// Pick black or white text for the given background for best contrast
export function pickTextColor(background: string, light = '#FFFFFF', dark = '#111827'): string {
  const rgb = hexToRgb(background);
  if (!rgb) {
    // Fallback to dark text
    return dark;
  }
  const bgLum = relativeLuminance(rgb);
  const whiteLum = relativeLuminance({ r: 255, g: 255, b: 255 });
  const blackLum = relativeLuminance({ r: 0, g: 0, b: 0 });
  const contrastWithWhite = contrastRatio(bgLum, whiteLum);
  const contrastWithBlack = contrastRatio(bgLum, blackLum);

  // Prefer higher contrast; fall back to configured light/dark tokens
  return contrastWithWhite >= contrastWithBlack ? light : dark;
}

export function rgbaFromHex(hex: string, alpha: number): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

