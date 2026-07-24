
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import {
  fetchMemoriaSource,
  fetchOptionalMemoriaLogo,
  getMemoriaPdfValidationMessage,
  isPdfBytes,
  reportMemoriaDocumentFailure,
  requireMemoriaContext,
  SourceByteBudget,
  uploadGeneratedMemoriaPdf,
} from "../_shared/memoriaSecurity.ts";
import { createHttpHandler, HttpError, jsonResponse } from "../_shared/http.ts";

serve(createHttpHandler(async (req) => {
    const { documentUrls, logoUrl, projectName, supabase, userId } = await requireMemoriaContext(
      req,
      ["material", "weight", "power", "rigging", "memoria_completa"],
      "generate-lights-memoria-tecnica",
    );
    const sourceBudget = new SourceByteBudget();
    console.log("Generating lights memoria", { documentCount: Object.keys(documentUrls).length, userId });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();
    
    // Standard page dimensions
    const width = 595;
    const height = 842;
    const headerHeight = 35;
    
    // Corporate color (matches the existing brand)
    const corporateColor = rgb(125/255, 1/255, 1/255);

    // Check if this is a complete memoria request - this is our key condition
    const isMemoriaCompleta = documentUrls.memoria_completa ? true : false;
    console.log(`Generation mode: ${isMemoriaCompleta ? 'Complete memoria' : 'Regular memoria'}`);
    
    // Create cover page
    const coverPage = mergedPdf.addPage([width, height]);
    
    // Add corporate header
    coverPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor,
    });

    // Add title
    coverPage.drawText('Memoria Tecnica - Iluminación', {
      x: 160,
      y: height - 25,
      size: 24,
      color: rgb(1, 1, 1),
      maxWidth: width - 40,
    });

    // Add project name
    coverPage.drawText(projectName.toUpperCase(), {
      x: (width / 2) - 30,
      y: height / 2 + 12,
      size: 24,
      color: rgb(0, 0, 0),
      maxWidth: width - 40,
    });

    // Caller-provided sources were validated as this project's Storage URLs and
    // are fetched with strict redirect, time, and byte limits.
    if (logoUrl) {
      try {
        const logo = await fetchOptionalMemoriaLogo(logoUrl, sourceBudget);
        if (!logo) throw new Error("Logo is missing");
        const logoImage = logo.format === "png"
          ? await mergedPdf.embedPng(logo.bytes)
          : await mergedPdf.embedJpg(logo.bytes);
        
        const maxLogoHeight = 100;
        const maxLogoWidth = 200;
        
        // Check if dimensions are valid
        if (logoImage.width <= 0 || logoImage.height <= 0) {
          throw new Error('Invalid logo dimensions');
        }
        
        const scaleFactor = Math.min(
          maxLogoWidth / logoImage.width,
          maxLogoHeight / logoImage.height
        );
        const scaledWidth = logoImage.width * scaleFactor;
        const scaledHeight = logoImage.height * scaleFactor;

        coverPage.drawImage(logoImage, {
          x: (width - scaledWidth) / 2,
          y: height - headerHeight - scaledHeight - 50,
          width: scaledWidth,
          height: scaledHeight,
        });
      } catch (error) {
        console.warn("Lights memoria logo omitted", error instanceof Error ? error.message : error);
      }
    }

    // Fixed application asset; do not use fetch on a URL assembled from input.
    try {
      const { data: asset, error } = await supabase.storage
        .from("company-assets")
        .download("sector-pro-logo.png");
      if (error || !asset) throw new Error("Footer logo not found");
      const logoBytes = new Uint8Array(await asset.arrayBuffer());
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetHeight = 20;
      const targetWidth = (sectorProLogo.width / sectorProLogo.height) * targetHeight;
      
      coverPage.drawImage(sectorProLogo, {
        x: (width - targetWidth) / 2,
        y: 40,
        width: targetWidth,
        height: targetHeight,
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo:', error);
    }

    if (isMemoriaCompleta) {
      // For memoria completa, just append the complete document after the cover page
      console.log('Appending complete memoria PDF');
      try {
        const sourceBytes = await fetchMemoriaSource(documentUrls.memoria_completa, sourceBudget);
        if (!isPdfBytes(sourceBytes)) {
          throw new HttpError(422, getMemoriaPdfValidationMessage("Memoria técnica completa", "invalid"), { code: "invalid_pdf_source" });
        }
        const pdf = await PDFDocument.load(sourceBytes);
        if (pdf.getPageCount() > 150) {
          throw new HttpError(422, getMemoriaPdfValidationMessage("Memoria técnica completa", "page_limit"), { code: "pdf_page_limit" });
        }
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        console.log(`Added ${pages.length} pages from complete memoria`);
      } catch (error) {
        throw reportMemoriaDocumentFailure(
          "generate-lights-memoria-tecnica",
          "memoria_completa",
          "Memoria técnica completa",
          error,
        );
      }
    } else {
      // For regular memoria, create table of contents and append individual documents
      console.log('Creating regular memoria with individual documents');
      
      // Create table of contents page
      const tocPage = mergedPdf.addPage([width, height]);
      
      // Add "Tabla de Contenidos" title
      tocPage.drawText('Tabla de Contenidos', {
        x: 50,
        y: height - 100,
        size: 24,
        color: rgb(0, 0, 0),
      });

      // Define the documents order and titles
      const documentOrder = [
        { id: 'material', title: 'Listado de Material' },
        { id: 'weight', title: 'Informe de Pesos' },
        { id: 'power', title: 'Informe de Consumos' },
        { id: 'rigging', title: 'Plano de Rigging' },
      ];

      // Add table of contents entries
      let entryY = height - 150;
      let entryNumber = 1;

      documentOrder.forEach(doc => {
        if (documentUrls[doc.id]) {
          tocPage.drawText(`${entryNumber}. ${doc.title}`, {
            x: 50,
            y: entryY,
            size: 14,
            color: rgb(0, 0, 0),
          });
          entryY -= 30;
          entryNumber++;
        }
      });

      // Append all document PDFs in order
      for (const doc of documentOrder) {
        const url = documentUrls[doc.id];
        if (!url) continue;

        try {
          const sourceBytes = await fetchMemoriaSource(url, sourceBudget);
          if (!isPdfBytes(sourceBytes)) {
            throw new HttpError(422, getMemoriaPdfValidationMessage(doc.title, "invalid"), { code: "invalid_pdf_source" });
          }
          const pdf = await PDFDocument.load(sourceBytes);
          if (pdf.getPageCount() > 150) {
            throw new HttpError(422, getMemoriaPdfValidationMessage(doc.title, "page_limit"), { code: "pdf_page_limit" });
          }
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach(page => mergedPdf.addPage(page));
          console.log(`Added ${pages.length} pages from ${doc.id}`);
        } catch (error) {
          throw reportMemoriaDocumentFailure(
            "generate-lights-memoria-tecnica",
            doc.id,
            doc.title,
            error,
          );
        }
      }
    }

    const pdfBytes = await mergedPdf.save();
    const safeProjectName = projectName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80) || "proyecto";
    const fileName = `memoria_tecnica_${safeProjectName}_${Date.now()}.pdf`;
    return jsonResponse(await uploadGeneratedMemoriaPdf(supabase, projectName, fileName, pdfBytes, {
      bucketCandidates: ["lights-memoria-tecnica"],
    }));
}), {
  onError: (error) => console.error("generate-lights-memoria-tecnica failed", error),
});
