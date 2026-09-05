import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import {
  fetchMemoriaSource,
  getMemoriaPdfValidationMessage,
  isPdfBytes,
  reportMemoriaDocumentFailure,
  requireMemoriaContext,
  SourceByteBudget,
  uploadGeneratedMemoriaPdf,
} from "../_shared/memoriaSecurity.ts";
import {
  buildMemoriaFrontMatter,
  loadMemoriaBranding,
  type MemoriaSection,
} from "../_shared/memoriaAssembly.ts";
import { createHttpHandler, HttpError, jsonResponse } from "../_shared/http.ts";

/** Fixed order: the index and the appended documents must agree on it. */
const DOCUMENT_ORDER = [
  { id: "material", title: "Listado de material" },
  { id: "weight", title: "Informe de pesos" },
  { id: "power", title: "Informe de consumos" },
  { id: "rigging", title: "Plano de rigging" },
] as const;

serve(createHttpHandler(async (req) => {
    const { documentUrls, logoUrl, projectName, supabase, userId } = await requireMemoriaContext(
      req,
      ["material", "weight", "power", "rigging", "memoria_completa"],
      "generate-lights-memoria-tecnica",
    );
    const sourceBudget = new SourceByteBudget();
    console.log("Generating lights memoria", { documentCount: Object.keys(documentUrls).length, userId });

    const mergedPdf = await PDFDocument.create();

    // A pre-built memoria is one document: it gets a cover and no index.
    const isMemoriaCompleta = Boolean(documentUrls.memoria_completa);
    const requested = isMemoriaCompleta
      ? [{ id: "memoria_completa", title: "Memoria técnica completa" }]
      : DOCUMENT_ORDER.filter((entry) => documentUrls[entry.id]);

    // Every source is loaded before anything is drawn: the index states the
    // page each document starts on, which is only knowable once their page
    // counts are.
    const loaded: Array<MemoriaSection & { doc: PDFDocument }> = [];
    for (const entry of requested) {
      const url = documentUrls[entry.id];
      if (!url) continue;
      try {
        const sourceBytes = await fetchMemoriaSource(url, sourceBudget);
        if (!isPdfBytes(sourceBytes)) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(entry.title, "invalid"), { code: "invalid_pdf_source" });
        }
        const pdf = await PDFDocument.load(sourceBytes);
        if (pdf.getPageCount() > 150) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(entry.title, "page_limit"), { code: "pdf_page_limit" });
        }
        loaded.push({ title: entry.title, pageCount: pdf.getPageCount(), doc: pdf });
      } catch (error) {
        throw reportMemoriaDocumentFailure(
          "generate-lights-memoria-tecnica",
          entry.id,
          entry.title,
          error,
        );
      }
    }

    const branding = await loadMemoriaBranding(mergedPdf, supabase, logoUrl, sourceBudget);
    await buildMemoriaFrontMatter(mergedPdf, {
      department: "Iluminación",
      projectName,
      branding,
      sections: isMemoriaCompleta
        ? undefined
        : loaded.map(({ title, pageCount }) => ({ title, pageCount })),
    });

    for (const { doc } of loaded) {
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80) || "proyecto";
    const fileName = `memoria_tecnica_${safeProjectName}_${Date.now()}.pdf`;
    return jsonResponse(await uploadGeneratedMemoriaPdf(supabase, projectName, fileName, pdfBytes, {
      bucketCandidates: ["lights-memoria-tecnica"],
    }));
}, {
  onError: (error) => console.error("generate-lights-memoria-tecnica failed", error),
}));
