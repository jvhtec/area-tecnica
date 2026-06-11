type FunctionErrorPayload = {
  details?: unknown;
  error?: unknown;
  message?: unknown;
  reason?: unknown;
  request_id?: unknown;
  response?: unknown;
  status?: unknown;
};

const DEFAULT_FALLBACK = "Edge Function request failed";
const MAX_DETAIL_LENGTH = 800;

const toDisplayString = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return undefined;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const truncateDetail = (value: string) => {
  if (value.length <= MAX_DETAIL_LENGTH) return value;
  return `${value.slice(0, MAX_DETAIL_LENGTH)}...`;
};

export const extractFunctionErrorMessage = async (
  error: unknown,
  fallback = DEFAULT_FALLBACK,
) => {
  const candidate = error as { details?: unknown; message?: unknown };
  const fallbackMessage = toDisplayString(candidate?.details) || toDisplayString(candidate?.message) || fallback;
  const response = (error as { context?: Response })?.context;
  if (!response || typeof response.clone !== "function") return fallbackMessage;

  try {
    const payload = await response.clone().json();
    if (!payload || typeof payload !== "object") return fallbackMessage;

    const data = payload as FunctionErrorPayload;
    const title = toDisplayString(data.error) || toDisplayString(data.message) || fallbackMessage;
    const detail = toDisplayString(data.reason) || toDisplayString(data.details) || toDisplayString(data.response);
    const status = toDisplayString(data.status);
    const requestId = toDisplayString(data.request_id);
    const statusSuffix = status ? ` (${status})` : "";
    const requestSuffix = requestId ? ` [${requestId}]` : "";

    return detail
      ? `${title}${statusSuffix}${requestSuffix}: ${truncateDetail(detail)}`
      : `${title}${statusSuffix}${requestSuffix}`;
  } catch {
    return fallbackMessage;
  }
};
