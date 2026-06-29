// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  DOCUMENT_UPLOAD_ACCEPT,
  getDocumentUploadValidationError,
} from "@/utils/documentUploadValidation";
import {
  ALLOWED_FILE_TYPES as SOUNDVISION_ALLOWED_FILE_TYPES,
  validateFile as validateSoundVisionFile,
} from "@/utils/soundvisionFileValidation";

const createFile = (name: string, type = "") =>
  new File(["technical file"], name, { type });

describe("document upload validation", () => {
  const technicalExtensions = [".xmlp", ".xmlc", ".xmls", ".dwg", ".dfx", ".dxf"];

  it("exposes technical and CAD formats in the shared accept string", () => {
    for (const extension of technicalExtensions) {
      expect(DOCUMENT_UPLOAD_ACCEPT.split(",")).toContain(extension);
    }
  });

  it("accepts SoundVision and CAD files through the shared document validator", () => {
    const files = [
      createFile("project.xmlp", "application/xml"),
      createFile("config.xmlc", "text/xml"),
      createFile("scene.xmls"),
      createFile("plot.dwg", "application/octet-stream"),
      createFile("legacy.dfx"),
      createFile("cad-export.dxf", "application/dxf"),
      createFile("stage-plot.webp", "image/webp"),
    ];

    expect(getDocumentUploadValidationError(files)).toBeNull();
  });

  it("still rejects unsupported extensions", () => {
    expect(getDocumentUploadValidationError([createFile("payload.exe", "application/octet-stream")]))
      .toContain("Tipo de archivo no permitido");
  });
});

describe("SoundVision file validation", () => {
  it("accepts the SoundVision and CAD formats used by technical teams", () => {
    for (const extension of [".xmlp", ".xmlc", ".xmls", ".dwg", ".dfx", ".dxf"]) {
      expect(SOUNDVISION_ALLOWED_FILE_TYPES).toContain(extension);
      expect(validateSoundVisionFile(createFile(`venue${extension}`, "application/octet-stream"))).toEqual({
        valid: true,
      });
    }
  });
});
