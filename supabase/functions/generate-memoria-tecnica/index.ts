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
  MEMORIA_PAGE,
} from "../_shared/memoriaAssembly.ts";
import { createHttpHandler, HttpError, jsonResponse } from "../_shared/http.ts";

const TITLES: Record<string, string> = {
  material: "Listado de material",
  soundvision: "Informe SoundVision",
  weight: "Informe de pesos",
  power: "Informe de consumos",
  rigging: "Plano de rigging",
};

serve(createHttpHandler(async (req) => {
    const { documentUrls, logoUrl, projectName, supabase, userId } = await requireMemoriaContext(
      req,
      ["material", "soundvision", "weight", "power", "rigging"],
      "generate-memoria-tecnica",
    );
    const sourceBudget = new SourceByteBudget();
    console.log("Generating sound memoria", { documentCount: Object.keys(documentUrls).length, userId });

    const mergedPdf = await PDFDocument.create();

    // Every source is loaded before anything is drawn: the index states the
    // page each document starts on, which is only knowable once their page
    // counts are.
    const loaded: Array<{ title: string; doc: PDFDocument }> = [];
    for (const [key, url] of Object.entries(documentUrls)) {
      const documentLabel = TITLES[key] ?? key;
      try {
        const sourceBytes = await fetchMemoriaSource(url, sourceBudget);
        if (!isPdfBytes(sourceBytes)) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(documentLabel, "invalid"), { code: "invalid_pdf_source" });
        }
        const pdf = await PDFDocument.load(sourceBytes);
        if (pdf.getPageCount() > 150) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(documentLabel, "page_limit"), { code: "pdf_page_limit" });
        }
        loaded.push({ title: documentLabel, doc: pdf });
      } catch (error) {
        throw reportMemoriaDocumentFailure(
          "generate-memoria-tecnica",
          key,
          documentLabel,
          error,
        );
      }
    }

    const branding = await loadMemoriaBranding(mergedPdf, supabase, logoUrl, sourceBudget);
    await buildMemoriaFrontMatter(mergedPdf, {
      department: "Sonido",
      projectName,
      branding,
      sections: loaded.map(({ title, doc }) => ({ title, pageCount: doc.getPageCount() })),
    });

    for (const { doc } of loaded) {
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    const pdfBytes = await mergedPdf.save();
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);

    const displayProjectName = projectName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Requested format: Memoria Tecnica Sonido - Job Name (DDMMYY).pdf
    const fileName = `Memoria Tecnica Sonido - ${displayProjectName} (${dd}${mm}${yy}).pdf`;
    return jsonResponse(await uploadGeneratedMemoriaPdf(supabase, projectName, fileName, pdfBytes));
}, {
  onError: (error) => console.error("generate-memoria-tecnica failed", error),
}));
