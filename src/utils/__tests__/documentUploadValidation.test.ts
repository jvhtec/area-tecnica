// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMAT_LABEL,
  getDocumentUploadErrorMessage,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";
import {
  ALLOWED_FILE_TYPES as SOUNDVISION_ALLOWED_FILE_TYPES,
  validateFile as validateSoundVisionFile,
} from "@/utils/soundvisionFileValidation";

const createFile = (name: string, type = "") =>
  new File(["technical file"], name, { type });

describe("document upload validation", () => {
  const technicalExtensions = [".xmlp", ".xmlc", ".xmls", ".nwm", ".dwg", ".dfx", ".dxf", ".mvr"];

  it("exposes technical and CAD formats in the shared accept string", () => {
    for (const extension of technicalExtensions) {
      expect(DOCUMENT_UPLOAD_ACCEPT.split(",")).toContain(extension);
    }
  });

  it("derives the visible format label from every accepted extension", () => {
    expect(DOCUMENT_UPLOAD_FORMAT_LABEL.split(", ")).toEqual(
      DOCUMENT_UPLOAD_ACCEPT.split(",").map((extension) => extension.slice(1).toUpperCase()),
    );
  });

  it("accepts SoundVision and CAD files through the shared document validator", () => {
    const files = [
      createFile("project.xmlp", "application/xml"),
      createFile("config.xmlc", "text/xml"),
      createFile("scene.xmls"),
      createFile("model.nwm", "application/octet-stream"),
      createFile("plot.dwg", "application/octet-stream"),
      createFile("legacy.dfx"),
      createFile("cad-export.dxf", "application/dxf"),
      createFile("stage-plot.webp", "image/webp"),
      createFile("rig.mvr", "application/zip"),
    ];

    expect(getDocumentUploadValidationError(files)).toBeNull();
  });

  it("still rejects unsupported extensions", () => {
    expect(getDocumentUploadValidationError([createFile("payload.exe", "application/octet-stream")]))
      .toContain("Tipo de archivo no permitido");
  });

  it("maps provider upload failures to actionable Spanish messages", () => {
    expect(getDocumentUploadErrorMessage(new Error("Failed to fetch")))
      .toBe("No se pudo conectar con el servidor de archivos. Revisa tu conexión e inténtalo de nuevo.");
    expect(getDocumentUploadErrorMessage(new Error("User not authenticated")))
      .toContain("Tu sesión no es válida");
    expect(getDocumentUploadErrorMessage({ message: "new row violates row-level security", code: "42501" }))
      .toBe("No tienes permiso para subir este documento.");
    expect(getDocumentUploadErrorMessage(new Error("opaque provider failure")))
      .toBe("No se pudo completar la subida. Inténtalo de nuevo y, si el problema continúa, contacta con soporte.");
  });
});

describe("SoundVision file validation", () => {
  it("accepts the SoundVision and CAD formats used by technical teams", () => {
    for (const extension of [".xmlp", ".xmlc", ".xmls", ".nwm", ".dwg", ".dfx", ".dxf", ".mvr"]) {
      expect(SOUNDVISION_ALLOWED_FILE_TYPES).toContain(extension);
      expect(validateSoundVisionFile(createFile(`venue${extension}`, "application/octet-stream"))).toEqual({
        valid: true,
      });
    }
  });
});
