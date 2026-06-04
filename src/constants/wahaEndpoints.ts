export const WAHA_ENDPOINTS = [
  { label: "WAHA 1", value: "https://waha.sector-pro.work" },
  { label: "WAHA 2", value: "https://waha2.sector-pro.work" },
  { label: "WAHA 3", value: "https://waha3.sector-pro.work" },
  { label: "WAHA 4", value: "https://waha4.sector-pro.work" },
  { label: "WAHA 5", value: "https://waha5.sector-pro.work" },
] as const;

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
  return match?.label || normalized || "Sin endpoint";
}
