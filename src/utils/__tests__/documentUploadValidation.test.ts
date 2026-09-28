// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_FORMAT_LABEL,
  getDocumentUploadErrorMessage,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";
import {
  DOCUMENT_UPLOAD_EXTENSIONS,
  SHOW_FILE_EXTENSIONS,
  TECHNICAL_DOCUMENT_EXTENSIONS,
} from "@/constants/documentUploadTypes";
import {
  ALLOWED_EXTENSIONS as PUBLIC_FORM_ALLOWED_EXTENSIONS,
  SHOW_FILE_EXTENSIONS as PUBLIC_FORM_SHOW_FILE_EXTENSIONS,
  getFileExtension as getPublicFormFileExtension,
} from "../../../supabase/functions/upload-public-artist-rider/fileRules";
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
      DOCUMENT_UPLOAD_EXTENSIONS.map((extension) => extension.toUpperCase()),
    );
  });

  it("offers every extension to the file picker, compound ones by their last part", () => {
    const accept = DOCUMENT_UPLOAD_ACCEPT.split(",");
    for (const extension of DOCUMENT_UPLOAD_EXTENSIONS) {
      expect(accept).toContain(`.${extension.split(".").pop()}`);
    }
    expect(new Set(accept).size).toBe(accept.length);
  });

  it("accepts console and lighting-desk show files", () => {
    const files = [
      createFile("FOH Yamaha CL5.CLF"),
      createFile("tf-rider.tff", "application/octet-stream"),
      createFile("DiGiCo SD12 show.ses"),
      createFile("m32-scene.scn"),
      createFile("x32-show.shw"),
      createFile("x32-snippet.snp"),
      createFile("magicq-show.shw", "application/octet-stream"),
      createFile("grandMA3 festival.show"),
      createFile("grandMA2_festival.show.gz", "application/gzip"),
      createFile("eos-show.esf"),
      createFile("venue-s6l-show.zip", "application/zip"),
    ];

    expect(getDocumentUploadValidationError(files)).toBeNull();
  });

  it("only allows gz as grandMA2's show.gz, not as a double extension", () => {
    expect(getDocumentUploadValidationError([createFile("logs.gz", "application/gzip")]))
      .toContain("Tipo de archivo no permitido");
    expect(getDocumentUploadValidationError([createFile("payload.exe.show.gz")]))
      .toContain("múltiples extensiones");
    expect(getDocumentUploadValidationError([createFile("rider.pdf.zip", "application/zip")]))
      .toContain("múltiples extensiones");
  });

  it("keeps the public artist form's show-file list in sync with the app", () => {
    expect([...PUBLIC_FORM_SHOW_FILE_EXTENSIONS]).toEqual([...SHOW_FILE_EXTENSIONS]);
    for (const extension of [...TECHNICAL_DOCUMENT_EXTENSIONS, ...SHOW_FILE_EXTENSIONS]) {
      expect(PUBLIC_FORM_ALLOWED_EXTENSIONS.has(extension)).toBe(true);
    }
    expect(getPublicFormFileExtension("Festival.SHOW.GZ")).toBe("show.gz");
    expect(getPublicFormFileExtension("rider.pdf")).toBe("pdf");
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
