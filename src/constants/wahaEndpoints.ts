export type WahaEndpointOption = {
  label: string;
  value: string;
};

const DEFAULT_WAHA_ENDPOINT_FAMILY_SIZE = 6;
const WAHA_ENDPOINT_ROOT_DOMAIN = "sector-pro.work";

function wahaEndpointForIndex(index: number) {
  return index === 1
    ? `https://waha.${WAHA_ENDPOINT_ROOT_DOMAIN}`
    : `https://waha${index}.${WAHA_ENDPOINT_ROOT_DOMAIN}`;
}

function getWahaEndpointIndex(endpoint: string | null | undefined) {
  const normalized = normalizeWahaEndpoint(endpoint);
  if (!normalized) return null;

  try {
    const host = new URL(normalized).hostname.toLowerCase();
    const match = host.match(/^waha(\d*)\.sector-pro\.work$/);
    if (!match) return null;

    return match[1] ? Number(match[1]) : 1;
  } catch {
    return null;
  }
}

export function buildWahaEndpointOptions(count = DEFAULT_WAHA_ENDPOINT_FAMILY_SIZE): WahaEndpointOption[] {
  const safeCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : DEFAULT_WAHA_ENDPOINT_FAMILY_SIZE;

  return Array.from({ length: safeCount }, (_, index) => {
    const endpointIndex = index + 1;

    return {
      label: `WAHA ${endpointIndex}`,
      value: wahaEndpointForIndex(endpointIndex),
    };
  });
}

export const WAHA_ENDPOINTS = buildWahaEndpointOptions();

export const NO_WAHA_ENDPOINT = "__none__";

export function normalizeWahaEndpoint(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export function getWahaEndpointLabel(endpoint: string | null | undefined) {
  const normalized = normalizeWahaEndpoint(endpoint);
  const match = WAHA_ENDPOINTS.find((option) => option.value === normalized);
  const generatedIndex = getWahaEndpointIndex(normalized);

  return match?.label || (generatedIndex ? `WAHA ${generatedIndex}` : normalized) || "Sin endpoint";
}
