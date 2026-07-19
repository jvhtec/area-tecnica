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
import { parseNwmXml, parseXmlpXml, type NwmMap } from "./parse.ts";
import { canUseLaSessionTools } from "./access.ts";

// Technician access is additionally checked against the permanent per-profile
// entitlement below; keeping the function privileged-role classified prevents
// the XMLP/NWM decryption service from becoming a general authenticated API.
const ALLOWED_ROLES = new Set(["admin", "management", "house_tech", "technician"]);

// Generous ceiling: real sessions are tens–hundreds of KB; base64 adds ~33%.
// Cap the decrypted XML too so a crafted file can't exhaust memory.
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const MAX_XML_BYTES = 48 * 1024 * 1024;

const SQLITE_MAGIC = "SQLite format 3";

interface ParseSessionBody extends Record<string, unknown> {
  /** base64-encoded raw .nwm / .xmlp file bytes. */
  file?: unknown;
  /** Original client filename, used only as a display-name fallback. */
  fileName?: unknown;
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

function asciiToBytes(ascii: string, expectedLen: number, name: string): Uint8Array {
  const bytes = new TextEncoder().encode(ascii);
  if (bytes.length !== expectedLen) {
    throw new HttpError(500, "Server misconfigured", {
      code: "invalid_key_material",
      details: { name },
      exposeDetails: false,
    });
  }
  return bytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function readLeUint32(buf: Uint8Array, off: number): number {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

function stripPkcs7(data: Uint8Array): Uint8Array {
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 16 || pad > data.length) throw new Error("Bad PKCS#7 padding");
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) throw new Error("Bad PKCS#7 padding");
  }
  return data.subarray(0, data.length - pad);
}

/**
 * NM `.nwm`: SQLite → `chunks.nwm3Xml` blob → AES-256-CBC (raw, zero-padded,
 * trailing 4-byte LE plaintext length) → LZO1X (trailing 4-byte LE output
 * length) → UTF-8 XML.
 */
function decodeNwm(bytes: Uint8Array, key: Uint8Array, iv: Uint8Array): string {
  const blob = extractNwmBlob(bytes);
  if (blob.length < 20 || (blob.length - 4) % 16 !== 0) throw new Error("Unexpected chunk framing");
  const aesPlainLen = readLeUint32(blob, blob.length - 4);
  const cbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted: Uint8Array = cbc.decrypt(blob.subarray(0, blob.length - 4));
  if (aesPlainLen > decrypted.length || aesPlainLen < 4) throw new Error("Bad decrypted length");
  const lzoContainer = decrypted.subarray(0, aesPlainLen);
  const outLen = readLeUint32(lzoContainer, lzoContainer.length - 4);
  if (outLen <= 0 || outLen > MAX_XML_BYTES) throw new Error("Implausible decompressed size");
  const xmlBytes: Uint8Array = lzo1xDecompress(lzoContainer.subarray(0, lzoContainer.length - 4), outLen);
  return new TextDecoder("utf-8").decode(xmlBytes);
}

/** Soundvision `.xmlp`: whole file is AES-256-CBC (PKCS#7) over the UTF-8 XML. */
function decodeXmlp(bytes: Uint8Array, key: Uint8Array, iv: Uint8Array): string {
  if (bytes.length === 0 || bytes.length % 16 !== 0) throw new Error("Unexpected .xmlp framing");
  const cbc = new aesjs.ModeOfOperation.cbc(key, iv);
  const decrypted: Uint8Array = cbc.decrypt(bytes);
  return new TextDecoder("utf-8").decode(stripPkcs7(decrypted));
}

serve(
  createHttpHandler(
    async (req: Request) => {
      const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnvValues(
        ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const,
        (name) => Deno.env.get(name),
      );

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const caller = await requireAuthenticatedRole(supabase, req, {
        allowedRoles: ALLOWED_ROLES,
        logContext: "parse-la-session",
        forbiddenMessage: "No tiene acceso al diseñador NM/SV.",
      });

      const { data: callerProfile, error: callerProfileError } = await supabase
        .from("profiles")
        .select("department, soundvision_tool_access_enabled")
        .eq("id", caller.userId)
        .maybeSingle();

      if (callerProfileError) {
        console.error("[parse-la-session] Tool entitlement lookup failed:", callerProfileError.message);
        throw new HttpError(500, "Authorization lookup failed", {
          code: "authorization_lookup_failed",
          exposeDetails: false,
        });
      }

      if (!canUseLaSessionTools(
        caller.role,
        callerProfile?.department,
        Boolean(callerProfile?.soundvision_tool_access_enabled),
      )) {
        throw new HttpError(403, "No tiene acceso al diseñador NM/SV.", {
          code: "soundvision_tool_access_required",
        });
      }

      const body = await readBoundedJsonObject<ParseSessionBody>(req, { maxBytes: MAX_BODY_BYTES });
      if (typeof body.file !== "string" || body.file.length === 0) {
        throw new HttpError(400, "Missing base64 'file' field", { code: "missing_file" });
      }
      const fileName = typeof body.fileName === "string"
        ? body.fileName.slice(0, 200).replace(/^.*[\\/]/, "")
        : "";

      let fileBytes: Uint8Array;
      try {
        fileBytes = base64ToBytes(body.file);
      } catch {
        throw new HttpError(400, "Invalid base64 file payload", { code: "invalid_base64" });
      }

      // Dispatch by container: a SQLite header ⇒ NM `.nwm`; anything else ⇒
      // Soundvision `.xmlp` (a raw AES blob). Each format has its own key/IV,
      // set as deployment secrets; when a format's secret is unset that format
      // is simply disabled (503) rather than erroring cryptically.
      const isNwm =
        fileBytes.length >= SQLITE_MAGIC.length &&
        new TextDecoder().decode(fileBytes.subarray(0, SQLITE_MAGIC.length)) === SQLITE_MAGIC;

      let map: NwmMap;
      try {
        if (isNwm) {
          const keyHex = Deno.env.get("NWM_AES_KEY");
          const ivHex = Deno.env.get("NWM_AES_IV");
          if (!keyHex || !ivHex) {
            throw new HttpError(503, "La importación de archivos NM no está configurada.", {
              code: "nwm_import_disabled",
              exposeDetails: true,
            });
          }
          const xml = decodeNwm(fileBytes, hexToBytes(keyHex, 32, "NWM_AES_KEY"), hexToBytes(ivHex, 16, "NWM_AES_IV"));
          if (!xml.includes("<Nwm2") && !xml.includes("LAVIRTUALUNIT")) {
            throw new HttpError(422, "El archivo no parece una sesión de NM válida", { code: "nwm_not_recognized" });
          }
          map = parseNwmXml(xml);
        } else {
          const keyAscii = Deno.env.get("SV_AES_KEY");
          const ivAscii = Deno.env.get("SV_AES_IV");
          if (!keyAscii || !ivAscii) {
            throw new HttpError(503, "La importación de archivos Soundvision no está configurada.", {
              code: "xmlp_import_disabled",
              exposeDetails: true,
            });
          }
          const xml = decodeXmlp(fileBytes, asciiToBytes(keyAscii, 32, "SV_AES_KEY"), asciiToBytes(ivAscii, 16, "SV_AES_IV"));
          if (!xml.includes("<project") && !xml.includes("amplification")) {
            throw new HttpError(422, "El archivo no parece un proyecto de Soundvision válido", { code: "xmlp_not_recognized" });
          }
          map = parseXmlpXml(xml, fileName);
        }
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(422, "No se pudo descifrar el archivo de sesión", {
          code: "session_decrypt_failed",
          details: error instanceof Error ? error.message : undefined,
          exposeDetails: false,
        });
      }

      if (map.units.length === 0 && !map.flysheet?.arrays.length) {
        throw new HttpError(422, "La sesión no contiene amplificadores ni arrays compatibles", {
          code: "session_no_units_or_arrays",
        });
      }

      // Transient: we return the parsed map and never persist the file or XML.
      return jsonResponse({ ok: true, map });
    },
    { allowedMethods: ["POST"] },
  ),
);
