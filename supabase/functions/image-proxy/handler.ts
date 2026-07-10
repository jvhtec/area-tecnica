import { jsonResponse } from "../_shared/http.ts";

export function handleImageProxyRequest(): Response {
  return jsonResponse(
    {
      error: "Image proxy retired",
      code: "image_proxy_retired",
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

