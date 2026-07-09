
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import {
  fetchMemoriaSource,
  fetchOptionalMemoriaLogo,
  getMemoriaPdfValidationMessage,
  isPdfBytes,
  requireMemoriaContext,
  SourceByteBudget,
  uploadGeneratedMemoriaPdf,
} from "../_shared/memoriaSecurity.ts";
import { createHttpHandler, HttpError, jsonResponse } from "../_shared/http.ts";

serve(createHttpHandler(async (req) => {
    const { documentUrls, logoUrl, projectName, supabase, userId } = await requireMemoriaContext(
      req,
      ["material", "soundvision", "weight", "power", "rigging"],
      "generate-memoria-tecnica",
    );
    const sourceBudget = new SourceByteBudget();
    console.log("Generating sound memoria", { documentCount: Object.keys(documentUrls).length, userId });

    const mergedPdf = await PDFDocument.create();
    const width = 595;
    const height = 842;
    const headerHeight = 35;
    const corporateColor = rgb(125 / 255, 1 / 255, 1 / 255);

    // Create cover page
    const coverPage = mergedPdf.addPage([width, height]);

    // Add corporate header
    coverPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor
    });

    // Fonts for better measuring and centering
    const helveticaBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await mergedPdf.embedFont(StandardFonts.Helvetica);

    // Add title in white on header - truly centered
    const titleFontSize = 24;
    const titleText = 'Memoria Tecnica - Sonido';
    const titleWidth = helveticaBold.widthOfTextAtSize(titleText, titleFontSize);
    const titleX = Math.max(20, (width - titleWidth) / 2);
    coverPage.drawText(titleText, {
      x: titleX,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1),
      font: helveticaBold
    });

    // Add centered project name with wrapping
    const projectNameSize = 24;
    const maxNameWidth = width - 80;
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? current + ' ' + w : w;
        const testWidth = helveticaBold.widthOfTextAtSize(test.toUpperCase(), projectNameSize);
        if (testWidth <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      }
      if (current) lines.push(current);
      return lines;
    };
    const nameLines = wrapText(projectName, maxNameWidth);
    const totalNameHeight = nameLines.length * (projectNameSize + 4);
    let nameY = height / 2 + totalNameHeight / 2;
    for (const line of nameLines) {
      const lineText = line.toUpperCase();
      const lineWidth = helveticaBold.widthOfTextAtSize(lineText, projectNameSize);
      const lineX = Math.max(20, (width - lineWidth) / 2);
      coverPage.drawText(lineText, {
        x: lineX,
        y: nameY,
        size: projectNameSize,
        color: rgb(0, 0, 0),
        font: helveticaBold
      });
      nameY -= projectNameSize + 4;
    }

    // The request validator only accepts this project's Storage URLs; the
    // source fetch below additionally has strict redirect, time, and size limits.
    if (logoUrl) {
      try {
        const logo = await fetchOptionalMemoriaLogo(logoUrl, sourceBudget);
        if (!logo) throw new Error("Logo is missing");
        const logoImage = logo.format === "png"
          ? await mergedPdf.embedPng(logo.bytes)
          : await mergedPdf.embedJpg(logo.bytes);
        
        const maxLogoHeight = 100;
        const maxLogoWidth = 200;
        
        if (logoImage.width <= 0 || logoImage.height <= 0) {
          throw new Error('Invalid logo dimensions');
        }
        
        const scaleFactor = Math.min(maxLogoWidth / logoImage.width, maxLogoHeight / logoImage.height);
        const scaledWidth = logoImage.width * scaleFactor;
        const scaledHeight = logoImage.height * scaleFactor;

        coverPage.drawImage(logoImage, {
          x: (width - scaledWidth) / 2,
          y: height - headerHeight - scaledHeight - 50,
          width: scaledWidth,
          height: scaledHeight
        });

      } catch (error) {
        console.warn("Sound memoria logo omitted", error instanceof Error ? error.message : error);
      }
    }

    // These are fixed application assets, read through the service client rather
    // than through a caller-provided URL.
    const fetchFooterLogo = async (): Promise<Uint8Array | null> => {
      const candidates = [
        { bucket: "public logos", path: "sectorpro.png" },
        { bucket: "company-assets", path: "sector-pro-logo.png" },
      ];
      for (const candidate of candidates) {
        const { data, error } = await supabase.storage.from(candidate.bucket).download(candidate.path);
        if (!error && data) {
          return new Uint8Array(await data.arrayBuffer());
        }
      }
      return null;
    };

    // Add Sector Pro logo at the bottom
    try {
      const logoBytes = await fetchFooterLogo();
      if (!logoBytes) throw new Error('Footer logo not found in public logos or company-assets');
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetLogoHeight = 20;
      const targetLogoWidth = (sectorProLogo.width / sectorProLogo.height) * targetLogoHeight;
      
      coverPage.drawImage(sectorProLogo, {
        x: (width - targetLogoWidth) / 2,
        y: 40,
        width: targetLogoWidth,
        height: targetLogoHeight
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo:', error);
    }

    // Create index page
    const indexPage = mergedPdf.addPage([width, height]);

    // Add corporate header to index
    indexPage.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width: width,
      height: headerHeight,
      color: corporateColor
    });

    // Add index title (centered)
    const indexTitle = 'Tabla de Contenidos';
    const indexWidth = helveticaBold.widthOfTextAtSize(indexTitle, titleFontSize);
    const indexX = Math.max(20, (width - indexWidth) / 2);
    indexPage.drawText(indexTitle, {
      x: indexX,
      y: height - 25,
      size: titleFontSize,
      color: rgb(1, 1, 1),
      font: helveticaBold
    });

    // Add Sector Pro logo to index page
    try {
      const logoBytes = await fetchFooterLogo();
      if (!logoBytes) throw new Error('Footer logo not found for index');
      const sectorProLogo = await mergedPdf.embedPng(logoBytes);
      
      const targetLogoHeight = 20;
      const targetLogoWidth = (sectorProLogo.width / sectorProLogo.height) * targetLogoHeight;
      
      indexPage.drawImage(sectorProLogo, {
        x: (width - targetLogoWidth) / 2,
        y: 40,
        width: targetLogoWidth,
        height: targetLogoHeight
      });
    } catch (error) {
      console.error('Error adding Sector Pro logo to index:', error);
    }

    // Define document titles and their mappings
    const titles = {
      material: "Listado de Material",
      soundvision: "Informe SoundVision",
      weight: "Informe de Pesos",
      power: "Informe de Consumos",
      rigging: "Plano de Rigging"
    };

    // Add index items
    let yOffset = height - 100;
    const lineSpacing = 25;
    const leftMargin = 40;

    Object.entries(documentUrls).forEach(([key, _url]) => {
      if (titles[key]) {
        indexPage.drawText(`• ${titles[key]}`, {
          x: leftMargin,
          y: yOffset,
          size: 12,
          color: rgb(0, 0, 0)
        });
        yOffset -= lineSpacing;
      }
    });

    // Append every requested document. A malformed or unavailable document is
    // an explicit request failure rather than a silently incomplete PDF.
    for (const [key, url] of Object.entries(documentUrls)) {
      try {
        const sourceBytes = await fetchMemoriaSource(url, sourceBudget);
        if (!isPdfBytes(sourceBytes)) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(key, "invalid"), { code: "invalid_pdf_source" });
        }
        const pdfBytes = sourceBytes;
        const pdf = await PDFDocument.load(pdfBytes);
        if (pdf.getPageCount() > 150) {
          throw new HttpError(422, getMemoriaPdfValidationMessage(key, "page_limit"), { code: "pdf_page_limit" });
        }
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        console.warn("Sound memoria rejected PDF", { key });
        throw new HttpError(422, getMemoriaPdfValidationMessage(key, "unreadable"), {
          code: "invalid_pdf_source",
        });
      }
    }

    // Do not add footer to merged PDFs; only cover and index include logo.

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
}), {
  onError: (error) => console.error("generate-memoria-tecnica failed", error),
});
