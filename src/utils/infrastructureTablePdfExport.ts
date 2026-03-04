import { loadPdfLibs } from '@/utils/pdf/lazyPdf';

export interface InfrastructureItemData {
  type: 'cat6' | 'hma' | 'coax' | 'opticalcon_duo' | 'analog';
  enabled?: boolean;
  quantity: number;
}

export interface ArtistInfrastructureData {
  name: string;
  stage: number;
  providedBy: string;
  cat6: { enabled: boolean; quantity: number };
  hma: { enabled: boolean; quantity: number };
  coax: { enabled: boolean; quantity: number };
  opticalconDuo: { enabled: boolean; quantity: number };
  analog: number;
  other: string;
}

export interface InfrastructureTablePdfData {
  jobTitle: string;
  logoUrl?: string;
  artists: ArtistInfrastructureData[];
}

type RawInfrastructureArtist = Partial<ArtistInfrastructureData> & {
  infrastructure_provided_by?: string;
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeProvider = (value: unknown): string => {
  if (value === 'festival') return 'Festival';
  if (value === 'band') return 'Banda';
  if (value === 'mixed') return 'Mixto';
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return 'Festival';
};

const asItem = (enabled: unknown, quantity: unknown, fallbackEnabled: unknown, fallbackQuantity: unknown) => ({
  enabled: Boolean(enabled ?? fallbackEnabled),
  quantity: toNumber(quantity ?? fallbackQuantity),
});

export const normalizeInfrastructureArtistInput = (artist: RawInfrastructureArtist): ArtistInfrastructureData => {
  return {
    name: typeof artist.name === 'string' && artist.name.trim().length > 0 ? artist.name : 'Unnamed Artist',
    stage: toNumber(artist.stage, 1),
    providedBy: normalizeProvider(artist.providedBy ?? artist.infrastructure_provided_by),
    cat6: asItem(artist.cat6?.enabled, artist.cat6?.quantity, artist.infra_cat6, artist.infra_cat6_quantity),
    hma: asItem(artist.hma?.enabled, artist.hma?.quantity, artist.infra_hma, artist.infra_hma_quantity),
    coax: asItem(artist.coax?.enabled, artist.coax?.quantity, artist.infra_coax, artist.infra_coax_quantity),
    opticalconDuo: asItem(
      artist.opticalconDuo?.enabled,
      artist.opticalconDuo?.quantity,
      artist.infra_opticalcon_duo,
      artist.infra_opticalcon_duo_quantity,
    ),
    analog: toNumber(artist.analog ?? artist.infra_analog),
    other: typeof artist.other === 'string'
      ? artist.other
      : typeof artist.other_infrastructure === 'string'
        ? artist.other_infrastructure
        : '',
  };
};

export const hasInfrastructureContent = (artist: ArtistInfrastructureData): boolean => {
  return (
    artist.cat6.enabled ||
    artist.hma.enabled ||
    artist.coax.enabled ||
    artist.opticalconDuo.enabled ||
    artist.analog > 0 ||
    artist.other.trim().length > 0
  );
};

export const exportInfrastructureTablePDF = async (data: InfrastructureTablePdfData): Promise<Blob> => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const normalizedArtists = (data.artists || []).map((artist) =>
    normalizeInfrastructureArtistInput(artist as RawInfrastructureArtist),
  );

  if (normalizedArtists.length === 0) {
    throw new Error('No hay artistas para generar la tabla de infraestructura.');
  }

  const artistsByStage = normalizedArtists.reduce((acc, artist) => {
    const stageNum = artist.stage;
    if (!acc[stageNum]) {
      acc[stageNum] = [];
    }
    acc[stageNum].push(artist);
    return acc;
  }, {} as Record<number, ArtistInfrastructureData[]>);

  const stageNumbers = Object.keys(artistsByStage).map(Number).sort((a, b) => a - b);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const leftMargin = 10;
  const rightMargin = 10;
  const headerStartY = 30;
  const bottomMargin = 24;

  type HeaderLogo = {
    objectUrl: string;
    format: 'PNG' | 'JPEG';
    width: number;
    height: number;
  };
  let headerLogo: HeaderLogo | undefined;

  if (data.logoUrl) {
    try {
      const response = await fetch(data.logoUrl);
      if (response.ok) {
        const logoBlob = await response.blob();
        const objectUrl = URL.createObjectURL(logoBlob);
        const dimensions = await new Promise<{ width: number; height: number } | undefined>((resolve) => {
          const image = new Image();
          image.onload = () => resolve({ width: image.width, height: image.height });
          image.onerror = () => resolve(undefined);
          image.src = objectUrl;
        });
        if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
          headerLogo = {
            objectUrl,
            format: logoBlob.type.toLowerCase().includes('png') ? 'PNG' : 'JPEG',
            width: dimensions.width,
            height: dimensions.height,
          };
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      }
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }

  const drawStageHeader = (stageNum: number): void => {
    if (headerLogo) {
      const maxLogoWidth = 40;
      const maxLogoHeight = 15;
      const scale = Math.min(maxLogoWidth / headerLogo.width, maxLogoHeight / headerLogo.height);
      const drawWidth = headerLogo.width * scale;
      const drawHeight = headerLogo.height * scale;
      pdf.addImage(
        headerLogo.objectUrl,
        headerLogo.format,
        pageWidth - drawWidth - rightMargin,
        10,
        drawWidth,
        drawHeight,
      );
    }

    pdf.setTextColor(0);
    pdf.setFontSize(18);
    pdf.text(`${data.jobTitle} - Infraestructura - Escenario ${stageNum}`, leftMargin, 20);
  };

  let isFirstPage = true;

  for (const stageNum of stageNumbers) {
    const stageArtists = artistsByStage[stageNum];

    if (!isFirstPage) {
      pdf.addPage();
    }
    isFirstPage = false;

    const tableData = stageArtists.map(artist => {
      return [
        artist.name,
        `Escenario ${artist.stage}`,
        artist.providedBy,
        artist.cat6.enabled ? artist.cat6.quantity : '-',
        artist.hma.enabled ? artist.hma.quantity : '-',
        artist.coax.enabled ? artist.coax.quantity : '-',
        artist.opticalconDuo.enabled ? artist.opticalconDuo.quantity : '-',
        artist.analog > 0 ? artist.analog : '-',
        artist.other || '-'
      ];
    });

    const availableWidth = pageWidth - leftMargin - rightMargin;
    const ratios = [0.26, 0.10, 0.12, 0.07, 0.07, 0.07, 0.12, 0.07, 0.12];
    const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0) || 1;
    const columnStyles = ratios.reduce((acc, ratio, index) => {
      acc[index] = { cellWidth: availableWidth * (ratio / ratioSum) };
      return acc;
    }, {} as Record<number, { cellWidth: number }>);

    autoTable(pdf, {
      head: [[
        'Artista',
        'Escenario',
        'Proporcionado por',
        'CAT6',
        'HMA',
        'Coax',
        'OpticalCon Duo',
        'Lineas Analogicas',
        'Otros'
      ]],
      body: tableData,
      startY: headerStartY,
      margin: {
        left: leftMargin,
        right: rightMargin,
        top: headerStartY,
        bottom: bottomMargin,
      },
      headStyles: {
        fillColor: [125, 1, 1],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 245]
      },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      rowPageBreak: 'avoid',
      columnStyles,
      didDrawPage: () => {
        drawStageHeader(stageNum);
      },
    });
  }

  const sectorLogo = new Image();
  sectorLogo.crossOrigin = 'anonymous';
  sectorLogo.src = '/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png';
  await new Promise<void>((resolve) => {
    sectorLogo.onload = () => resolve();
    sectorLogo.onerror = () => resolve();
  });

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    const date = new Date().toLocaleDateString('es-ES');
    pdf.text(`Generado: ${date}`, leftMargin, pageHeight - 8);
    pdf.text(`Pagina ${i} de ${totalPages}`, pageWidth - rightMargin, pageHeight - 8, { align: 'right' });

    if (sectorLogo.width > 0 && sectorLogo.height > 0) {
      const logoWidth = 50;
      const logoHeight = logoWidth * (sectorLogo.height / sectorLogo.width);
      const xPosition = (pageWidth - logoWidth) / 2;
      const yLogo = pageHeight - 5 - logoHeight;
      try {
        pdf.addImage(sectorLogo, 'PNG', xPosition, yLogo, logoWidth, logoHeight);
      } catch (error) {
        console.error(`Error adding footer logo on page ${i}:`, error);
      }
    }
  }

  if (headerLogo) {
    URL.revokeObjectURL(headerLogo.objectUrl);
  }

  return pdf.output('blob');
};
