import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import aesjs from "npm:aes-js@3.1.2";
import { lzo1xDecompress } from "npm:lzo1x@1.0.1";
import { requireAuthenticatedRole } from "../_shared/auth.ts";
import {
  createHttpHandler,
  HttpError,
  jsonResponse,
  readBoundedJsonObject,
  requireEnvValues,
} from "../_shared/http.ts";
import { extractNwmBlob } from "./sqlite.ts";
import { parseNwmXml } from "./parse.ts";

// Roles allowed to import NM sessions. House techs run the amp systems, so they
// are included alongside admin/management.
const ALLOWED_ROLES = new Set(["admin", "management", "house_tech"]);

// A generous ceiling: real .nwm sessions are tens–hundreds of KB; base64 adds
// ~33%. Cap the decrypted XML too so a crafted file can't exhaust memory.
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_XML_BYTES = 32 * 1024 * 1024;

interface ParseNwmBody extends Record<string, unknown> {
  /** base64-encoded raw .nwm file bytes. */
  file?: unknown;
}

function hexToBytes(hex: string, expectedLen: number, name: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length !== expectedLen * 2) {
    throw new HttpError(500, "Server misconfigured", {
      code: "invalid_key_material",
      details: { name },
      exposeDetails: false,
    });
  }
  const out = new Uint8Array(expectedLen);
  for (let i = 0; i < expectedLen; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function readLeUint32(buf: Uint8Array, off: number): number {
  return ((buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0);
}

serve(
  createHttpHandler(
    async (req: Request) => {
      const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
        ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
        (name) => Deno.env.get(name),
      );

      // The decryption key/IV are deployment-set secrets (never committed). When
      // absent the feature is simply disabled rather than erroring cryptically.
      const keyHex = Deno.env.get("NWM_AES_KEY");
      const ivHex = Deno.env.get("NWM_AES_IV");
      if (!keyHex || !ivHex) {
        throw new HttpError(503, "NM import is not configured on this deployment", {
          code: "nwm_import_disabled",
          exposeDetails: true,
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await requireAuthenticatedRole(supabase, req, {
        allowedRoles: ALLOWED_ROLES,
        logContext: "parse-nwm",
        forbiddenMessage: "Solo admin, management o house_tech pueden importar sesiones de NM.",
      });

      const body = await readBoundedJsonObject<ParseNwmBody>(req, { maxBytes: MAX_BODY_BYTES });
      if (typeof body.file !== "string" || body.file.length === 0) {
        throw new HttpError(400, "Missing base64 'file' field", { code: "missing_file" });
      }

      let nwmBytes: Uint8Array;
      try {
        nwmBytes = base64ToBytes(body.file);
      } catch {
        throw new HttpError(400, "Invalid base64 file payload", { code: "invalid_base64" });
      }

      const key = hexToBytes(keyHex, 32, "NWM_AES_KEY");
      const iv = hexToBytes(ivHex, 16, "NWM_AES_IV");

      let xml: string;
      try {
        // .nwm container: SQLite → chunks.nwm3Xml blob → AES-256-CBC (raw,
        // zero-padded, trailing 4-byte LE plaintext length) → LZO1X (trailing
        // 4-byte LE output length) → UTF-8 XML.
        const blob = extractNwmBlob(nwmBytes);
        if (blob.length < 20 || (blob.length - 4) % 16 !== 0) {
          throw new Error("Unexpected chunk framing");
        }
        const aesPlainLen = readLeUint32(blob, blob.length - 4);
        const ciphertext = blob.subarray(0, blob.length - 4);

        const cbc = new aesjs.ModeOfOperation.cbc(key, iv);
        const decrypted: Uint8Array = cbc.decrypt(ciphertext);
        if (aesPlainLen > decrypted.length || aesPlainLen < 4) {
          throw new Error("Bad decrypted length");
        }
        const lzoContainer = decrypted.subarray(0, aesPlainLen);
        const outLen = readLeUint32(lzoContainer, lzoContainer.length - 4);
        if (outLen <= 0 || outLen > MAX_XML_BYTES) {
          throw new Error("Implausible decompressed size");
        }
        const xmlBytes: Uint8Array = lzo1xDecompress(
          lzoContainer.subarray(0, lzoContainer.length - 4),
          outLen,
        );
        xml = new TextDecoder("utf-8").decode(xmlBytes);
      } catch (error) {
        // A wrong/corrupt file or a key that doesn't fit this NM version.
        throw new HttpError(422, "No se pudo descifrar el archivo .nwm", {
          code: "nwm_decrypt_failed",
          details: error instanceof Error ? error.message : undefined,
          exposeDetails: false,
        });
      }

      if (!xml.includes("<Nwm2") && !xml.includes("LAVIRTUALUNIT")) {
        throw new HttpError(422, "El archivo no parece una sesión de NM válida", {
          code: "nwm_not_recognized",
        });
      }

      const map = parseNwmXml(xml);
      if (map.units.length === 0) {
        throw new HttpError(422, "La sesión no contiene amplificadores", {
          code: "nwm_no_units",
        });
      }

      // Transient: we return the parsed map and never persist the file or XML.
      return jsonResponse({ ok: true, map });
    },
    { allowedMethods: ["POST"] },
  ),
);
