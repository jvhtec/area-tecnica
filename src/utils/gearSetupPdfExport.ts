import { supabase } from '@/lib/supabase';
import { loadPdfLibs } from '@/utils/pdf/lazyPdf';
import { getLastAutoTableY, pdfToBlob } from '@/utils/pdf/exportHelpers';
import { loadImageWithTimeout } from '@/utils/pdf/shared/pdfExportShared';
import { formatFrequencyBand } from '@/lib/frequencyBands';
import { combineWavesDisplay } from '@/constants/wavesModels';
import {
  distributeColumnWidths,
  drawFestivalChrome,
  drawFestivalConstantsLine,
  drawFestivalMetaGrid,
  drawFestivalNilState,
  drawFestivalSectionHeading,
  drawFestivalTitleBlock,
  FESTIVAL_INK,
  FESTIVAL_MATRIX_ZERO,
  FESTIVAL_SOFT,
  festivalTableTheme,
  loadFestivalIssuerMark,
  setFestivalText,
  type FestivalGeometry,
} from '@/utils/pdf/festival-report';

const yesNo = (value: unknown): string => (value ? 'Sí' : 'No');

export const generateStageGearPDF = async (
  jobId: string,
  stageNumber: number,
  stageName?: string,
  logoUrl?: string,
  options: { paginate?: boolean } = {},
): Promise<Blob> => {
  return new Promise<Blob>((resolve, reject) => {
    // The work is async, so it runs in an IIFE rather than an async Promise
    // executor; the existing try/catch below forwards any failure to reject().
    void (async () => {
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      console.log(`Starting PDF generation for stage ${stageNumber} (${stageName})`);
      
      // Fetch stage name from database if not provided
      let resolvedStageName = stageName;
      if (!resolvedStageName) {
        const { data: stageData, error: stageError } = await supabase
          .from("festival_stages")
          .select("name")
          .eq("job_id", jobId)
          .eq("number", stageNumber)
          .maybeSingle();
        
        if (stageError) {
          console.error("Error fetching stage name:", stageError);
        }
        
        resolvedStageName = stageData?.name || `Escenario ${stageNumber}`;
      }
      // Narrowed to a plain string so the closures below don't see `string | undefined`.
      const actualStageName: string = resolvedStageName ?? `Escenario ${stageNumber}`;

      // Fetch job data
      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      if (jobError) {
        console.error("Error fetching job data:", jobError);
        reject(jobError);
        return;
      }

      // Get the gear setup (no date filter needed)
      const { data: gearSetup, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("*")
        .eq("job_id", jobId)
        .maybeSingle();

      if (gearError) {
        console.error("Error fetching gear setup:", gearError);
        reject(gearError);
        return;
      }

      if (!gearSetup) {
        console.log(`No gear setup found for job ${jobId}`);
        reject(new Error(`No gear setup found for festival`));
        return;
      }

      console.log(`Found gear setup:`, gearSetup);

      // Check for stage-specific setup
      const { data: stageSetup, error: stageSetupError } = await supabase
        .from("festival_stage_gear_setups")
        .select("*")
        .eq("gear_setup_id", gearSetup.id)
        .eq("stage_number", stageNumber)
        .maybeSingle();

      if (stageSetupError) {
        console.error("Error fetching stage setup:", stageSetupError);
      }

      // Determine which data to use: stage-specific takes priority over global
      const setupToUse = stageSetup || gearSetup;
      const isStageSpecific = !!stageSetup;
      
      console.log(`Using ${isStageSpecific ? 'stage-specific' : 'global'} setup data for stage ${stageNumber}:`, setupToUse);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      await loadFestivalIssuerMark();
      const clientLogo = logoUrl
        ? await loadImageWithTimeout(logoUrl, 'logotipo del festival')
        : null;

      const chrome = (): FestivalGeometry =>
        drawFestivalChrome(doc, {
          kind: 'gear',
          eventTitle: jobData.title,
          contextLabel: actualStageName,
          issuer: `Sector-Pro  ·  ${jobData.title}`,
          paginate: false,
        });

      const geo = chrome();
      const { mm } = geo;

      let y = drawFestivalTitleBlock(doc, geo, {
        eyebrow: 'Dotación de escenario  ·  Rev. A',
        title: actualStageName,
        subtitle: jobData.title,
        clientLogo,
      });

      const monitorQuantity = setupToUse.monitors_quantity
        || (isStageSpecific ? 0 : setupToUse.available_monitors || 0);
      const wirelessCount = setupToUse.wireless_systems?.length || 0;
      const iemCount = setupToUse.iem_systems?.length || 0;

      y = drawFestivalMetaGrid(doc, geo, [
        { label: 'Configuración', value: isStageSpecific ? 'Específica del escenario' : 'General del festival' },
        { label: 'Monitores', value: String(monitorQuantity) },
        { label: 'Sistemas RF', value: String(wirelessCount) },
        { label: 'Sistemas IEM', value: String(iemCount) },
      ], y);

      const ensureSpace = (required: number, current: number): number => {
        if (current + required <= geo.contentBottom) return current;
        doc.addPage();
        chrome();
        return geo.contentTop;
      };

      const tableMargin = {
        left: geo.left,
        right: geo.pageWidth - geo.right,
        top: geo.contentTop,
        bottom: geo.pageHeight - geo.contentBottom,
      };

      const drawTable = (
        head: string[],
        rows: string[][],
        weights: number[],
        numericColumns: number[],
        startY: number,
      ): number => {
        autoTable(doc, {
          head: [head],
          body: rows,
          startY,
          ...festivalTableTheme(geo, { fontSize: 7.6, numericColumns }),
          columnStyles: distributeColumnWidths(weights, geo.contentWidth),
          margin: tableMargin,
          rowPageBreak: 'avoid',
          showHead: 'everyPage',
          didDrawPage: () => {
            chrome();
          },
        });
        return getLastAutoTableY(doc, startY) + 8 * mm;
      };

      let sectionNumber = 1;

      // --- Consoles ---------------------------------------------------------
      const consoleRows: string[][] = [
        ...(setupToUse.foh_consoles ?? []).map((console: any) => [
          'FOH',
          console.model || 'Sin modelo',
          String(console.quantity ?? 1),
          console.notes || FESTIVAL_MATRIX_ZERO,
        ]),
        ...(setupToUse.mon_consoles ?? []).map((console: any) => [
          'Monitores',
          console.model || 'Sin modelo',
          String(console.quantity ?? 1),
          console.notes || FESTIVAL_MATRIX_ZERO,
        ]),
      ];

      y = ensureSpace(26 * mm, y);
      y = drawFestivalSectionHeading(doc, geo, 'Consolas', y, sectionNumber);
      sectionNumber += 1;

      if (consoleRows.length === 0) {
        y = drawFestivalNilState(doc, geo, y, 'No hay consolas registradas en la dotación de este escenario.');
      } else {
        y = drawTable(['Posición', 'Modelo', 'Cantidad', 'Notas'], consoleRows, [18, 34, 14, 34], [2], y);
      }

      const wavesLines = [
        combineWavesDisplay(setupToUse.foh_waves_models, setupToUse.foh_outboard)
          ? { label: 'FOH Waves / outboard', value: combineWavesDisplay(setupToUse.foh_waves_models, setupToUse.foh_outboard) }
          : null,
        combineWavesDisplay(setupToUse.mon_waves_models, setupToUse.mon_outboard)
          ? { label: 'MON Waves / outboard', value: combineWavesDisplay(setupToUse.mon_waves_models, setupToUse.mon_outboard) }
          : null,
      ].filter((entry): entry is { label: string; value: string } => entry !== null);
      if (wavesLines.length > 0) {
        y = drawFestivalConstantsLine(doc, geo, wavesLines, y - 4 * mm) + 4 * mm;
      }

      // --- Wireless and IEM -------------------------------------------------
      const rfRows: string[][] = [
        ...(setupToUse.wireless_systems ?? []).map((system: any) => [
          'RF',
          system.model || 'Sin modelo',
          String(system.quantity_ch ?? 0),
          String(system.quantity_hh ?? 0),
          String(system.quantity_bp ?? 0),
          formatFrequencyBand(system.band) || FESTIVAL_MATRIX_ZERO,
        ]),
        ...(setupToUse.iem_systems ?? []).map((system: any) => [
          'IEM',
          system.model || 'Sin modelo',
          String(system.quantity_hh ?? system.quantity ?? 0),
          FESTIVAL_MATRIX_ZERO,
          String(system.quantity_bp ?? 0),
          formatFrequencyBand(system.band) || FESTIVAL_MATRIX_ZERO,
        ]),
      ];

      y = ensureSpace(26 * mm, y);
      y = drawFestivalSectionHeading(doc, geo, 'Sistemas inalámbricos e IEM', y, sectionNumber);
      sectionNumber += 1;

      if (rfRows.length === 0) {
        y = drawFestivalNilState(
          doc,
          geo,
          y,
          'Sin sistemas inalámbricos ni IEM en la dotación. Confirmado como ninguno, no pendiente de definir.',
        );
      } else {
        y = drawTable(
          ['Tipo', 'Modelo', 'Canales', 'De mano', 'Petacas', 'Banda'],
          rfRows,
          [12, 30, 13, 13, 13, 19],
          [2, 3, 4],
          y,
        );
      }

      // --- Wired microphones -------------------------------------------------
      const micRows = (setupToUse.wired_mics ?? []).map((mic: any) => [
        mic.model || 'Sin modelo',
        String(mic.quantity ?? 1),
        yesNo(mic.exclusive_use),
        mic.notes || FESTIVAL_MATRIX_ZERO,
      ]);

      y = ensureSpace(26 * mm, y);
      y = drawFestivalSectionHeading(doc, geo, 'Microfonía cableada', y, sectionNumber);
      sectionNumber += 1;

      if (micRows.length === 0) {
        y = drawFestivalNilState(doc, geo, y, 'Sin microfonía cableada registrada para este escenario.');
      } else {
        y = drawTable(['Modelo', 'Cantidad', 'Uso exclusivo', 'Notas'], micRows, [34, 14, 18, 34], [1], y);
      }

      // --- Infrastructure ----------------------------------------------------
      const pick = (specific: unknown, fallback: unknown): number =>
        specific !== undefined && specific !== null ? Number(specific) || 0 : Number(fallback) || 0;

      const infraRows = [
        ['CAT6', String(pick(setupToUse.infra_cat6_quantity, setupToUse.available_cat6_runs))],
        ['HMA', String(pick(setupToUse.infra_hma_quantity, setupToUse.available_hma_runs))],
        ['Coaxial', String(pick(setupToUse.infra_coax_quantity, setupToUse.available_coax_runs))],
        ['Analógicas', String(pick(setupToUse.infra_analog, setupToUse.available_analog_runs))],
        ['OpticalCON DUO', String(pick(setupToUse.infra_opticalcon_duo_quantity, setupToUse.available_opticalcon_duo_runs))],
      ];

      y = ensureSpace(30 * mm, y);
      y = drawFestivalSectionHeading(doc, geo, 'Infraestructura disponible', y, sectionNumber);
      sectionNumber += 1;
      y = drawTable(['Tirada', 'Cantidad'], infraRows, [60, 40], [1], y);

      // --- Extras ------------------------------------------------------------
      const extras = [
        ['Side fills', yesNo(setupToUse.extras_sf ?? setupToUse.has_side_fills)],
        ['Drum fills', yesNo(setupToUse.extras_df ?? setupToUse.has_drum_fills)],
        ['Cabina de DJ', yesNo(setupToUse.extras_djbooth ?? setupToUse.has_dj_booths)],
        ['Monitores disponibles', String(monitorQuantity)],
      ];

      y = ensureSpace(28 * mm, y);
      y = drawFestivalSectionHeading(doc, geo, 'Extras', y, sectionNumber);
      sectionNumber += 1;
      y = drawTable(['Elemento', 'Disponible'], extras, [60, 40], [], y);

      // --- Notes -------------------------------------------------------------
      if (setupToUse.notes) {
        setFestivalText(doc, FESTIVAL_INK, 7.8);
        const notes = doc.splitTextToSize(String(setupToUse.notes), geo.contentWidth) as string[];
        y = ensureSpace(notes.length * 3.6 * mm + 14 * mm, y);
        y = drawFestivalSectionHeading(doc, geo, 'Notas', y, sectionNumber);
        setFestivalText(doc, FESTIVAL_INK, 7.8);
        doc.text(notes, geo.left, y, { lineHeightFactor: 1.35 });
      }

      setFestivalText(doc, FESTIVAL_SOFT, 7);

      const totalPages = doc.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        drawFestivalChrome(doc, {
          kind: 'gear',
          eventTitle: jobData.title,
          contextLabel: actualStageName,
          issuer: `Sector-Pro  ·  ${jobData.title}`,
          pageNumber: page,
          totalPages,
          paginate: options.paginate !== false,
        });
      }

      resolve(pdfToBlob(doc));
    } catch (error) {
      console.error('Error generating stage gear PDF:', error);
      reject(error);
    }
    })();
  });
};
