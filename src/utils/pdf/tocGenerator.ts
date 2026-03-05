import { PDFDocument, rgb } from 'pdf-lib';

export type TocChildEntry = {
  title: string;
  pageCount: number;
};

export type TocSection = {
  title: string;
  pageCount: number;
  children?: TocChildEntry[];
};

export type TocLinkRegion = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  targetPage: number;
};

export type TocGenerationResult = {
  blob: Blob;
  links: TocLinkRegion[];
  pageCount: number;
};

type TocLine = {
  title: string;
  indent: number;
  fontSize: number;
  targetPage: number;
};

export const generateTableOfContents = async (
  sections: TocSection[],
  logoUrl?: string
): Promise<TocGenerationResult> => {
  try {
    console.log('Generating table of contents');

    const pageHeight = 841.89;
    const startY = pageHeight - 200;
    const lineHeight = 30;
    const minY = 70;
    const rowsPerPage = Math.max(1, Math.floor((startY - minY) / lineHeight) + 1);

    const topLevelCount = sections.length;
    const childCount = sections.reduce((sum, section) => sum + (section.children?.length || 0), 0);
    const totalLines = topLevelCount + childCount;
    const tocPageCount = Math.max(1, Math.ceil(totalLines / rowsPerPage));

    const lines: TocLine[] = [];
    let currentTargetPage = 2 + tocPageCount;

    for (const section of sections) {
      const sectionStartPage = currentTargetPage;
      lines.push({
        title: section.title,
        indent: 0,
        fontSize: 12,
        targetPage: sectionStartPage,
      });

      if (section.children && section.children.length > 0) {
        let childPage = sectionStartPage;
        for (const child of section.children) {
          lines.push({
            title: child.title,
            indent: 1,
            fontSize: 11,
            targetPage: childPage,
          });
          childPage += child.pageCount;
        }
      }

      currentTargetPage += section.pageCount;
    }

    const pdfDoc = await PDFDocument.create();
    const tocLinks: TocLinkRegion[] = [];

    for (let tocPageIndex = 0; tocPageIndex < tocPageCount; tocPageIndex += 1) {
      const page = pdfDoc.addPage([595.28, pageHeight]);
      const { width, height } = page.getSize();

      page.drawRectangle({
        x: 0,
        y: height - 100,
        width,
        height: 100,
        color: rgb(125 / 255, 1 / 255, 1 / 255),
      });

      page.drawText('INDICE', {
        x: 50,
        y: height - 60,
        size: 24,
        color: rgb(1, 1, 1),
      });

      if (logoUrl) {
        try {
          const logoResponse = await fetch(logoUrl);
          const logoImageData = await logoResponse.arrayBuffer();
          const logoImage = logoUrl.toLowerCase().endsWith('.png')
            ? await pdfDoc.embedPng(logoImageData)
            : await pdfDoc.embedJpg(logoImageData);

          const imgWidth = 100;
          const imgHeight = (logoImage.height / logoImage.width) * imgWidth;

          page.drawImage(logoImage, {
            x: width - imgWidth - 50,
            y: height - 60 - imgHeight / 2 + 10,
            width: imgWidth,
            height: imgHeight,
          });
        } catch (logoError) {
          console.error('Error adding logo to TOC:', logoError);
        }
      }

      let currentY = height - 150;

      page.drawText('Seccion', {
        x: 50,
        y: currentY,
        size: 14,
        color: rgb(0, 0, 0),
      });

      page.drawText('Pagina', {
        x: width - 100,
        y: currentY,
        size: 14,
        color: rgb(0, 0, 0),
      });

      currentY -= 20;

      page.drawLine({
        start: { x: 50, y: currentY },
        end: { x: width - 50, y: currentY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      currentY -= 30;

      const pageStart = tocPageIndex * rowsPerPage;
      const pageLines = lines.slice(pageStart, pageStart + rowsPerPage);

      for (const line of pageLines) {
        const textX = line.indent === 0 ? 50 : 70;
        const dotStartX = line.indent === 0 ? 250 : 270;

        page.drawText(line.title, {
          x: textX,
          y: currentY,
          size: line.fontSize,
          color: rgb(0, 0, 0.1),
        });

        page.drawText(line.targetPage.toString(), {
          x: width - 100,
          y: currentY,
          size: line.fontSize,
          color: rgb(0, 0, 0),
        });

        let dotX = dotStartX;
        while (dotX < width - 105) {
          page.drawText('.', {
            x: dotX,
            y: currentY,
            size: line.fontSize,
            color: rgb(0.7, 0.7, 0.7),
          });
          dotX += 10;
        }

        tocLinks.push({
          pageIndex: tocPageIndex,
          x: textX,
          y: currentY - 2,
          width: width - textX - 40,
          height: 16,
          targetPage: line.targetPage,
        });

        currentY -= lineHeight;
      }

      page.drawText(`Pagina ${2 + tocPageIndex}`, {
        x: width / 2,
        y: 30,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const pdfBytes = await pdfDoc.save();
    return {
      blob: new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
      links: tocLinks,
      pageCount: tocPageCount,
    };
  } catch (error) {
    console.error('Error generating table of contents:', error);
    throw error;
  }
};
