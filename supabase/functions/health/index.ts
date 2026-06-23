import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { createHttpHandler, jsonResponse } from "../_shared/http.ts";

// Minimal liveness/readiness probe (ENT-OBS-02).
//
// This endpoint intentionally performs NO database, storage, or business
// queries and uses NO service-role credentials. It exists so external uptime
// monitors and load balancers can confirm the Edge runtime is serving without
// being exposed to internal health samples or error messages. Privileged
// integrity diagnostics live in the `system-health` function, which requires an
// authenticated admin/management caller.

serve(createHttpHandler(
  () =>
    jsonResponse({
      status: "ok",
      service: "edge",
      timestamp: new Date().toISOString(),
    }),
  {
    allowedMethods: ["GET"],
    internalErrorMessage: "Liveness probe failed",
  },
));
