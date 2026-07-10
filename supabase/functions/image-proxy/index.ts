import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

import { createHttpHandler } from "../_shared/http.ts";
import { handleImageProxyRequest } from "./handler.ts";

// Retired security boundary.
//
// The former implementation accepted arbitrary authenticated HTTPS URLs and
// fetched them with a server-side network identity. Textual hostname checks
// could not safely prevent DNS rebinding/TOCTOU SSRF. There are no in-repo
// callers, so fail closed instead of maintaining a general-purpose URL proxy.
serve(createHttpHandler(handleImageProxyRequest, {
  allowedMethods: ["POST"],
  internalErrorMessage: "Image proxy unavailable",
}));
