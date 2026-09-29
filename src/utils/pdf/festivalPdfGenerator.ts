import { supabase } from '@/lib/supabase';
import { assembleFestivalBundle } from '@/utils/pdf/festivalBundleAssembly';
import type { PrintOptions } from '@/features/festival-print/model';
import { buildReadableFilename } from '@/utils/fileName';
import {
  clampPdfConcurrency,
  type FestivalPdfGenerationOptions,
  type FestivalPdfProgress,
} from '@/utils/pdf/festivalPdfSupport';
import { generateFestivalShiftPdfs } from '@/utils/pdf/festivalPdfShiftSection';
import { loadFestivalPdfContext, loadStagePlotUrls } from '@/utils/pdf/festivalPdfContext';
import { generateArtistRequirementsSection } from './festival-sections/artistRequirementsSection';
import { generateArtistTablesSection } from './festival-sections/artistTablesSection';
import { buildBundleSections } from './festival-sections/bundleSections';
import type { FestivalSectionContext } from './festival-sections/context';
import { generateGearSection } from './festival-sections/gearSection';
import {
  generateInfrastructureSection,
  generateMissingRiderSection,
  generateRfIemSection,
  generateWiredMicSection,
} from './festival-sections/tableSections';
import { generateWeatherSection } from './festival-sections/weatherSection';
export type { FestivalPdfGenerationOptions, FestivalPdfProgress, FestivalPdfProgressPhase } from '@/utils/pdf/festivalPdfSupport';

/**
 * The festival's documentation as one numbered book: a section per selected document type, each
 * built by its own module under `festival-sections/`, then bound with a cover, contents and folios.
 */
export const generateAndMergeFestivalPDFs = async (
  jobId: string,
  jobTitle: string,
  options: PrintOptions,
  customFilename?: string,
  generationOptions: FestivalPdfGenerationOptions = {},
): Promise<{ blob: Blob; filename: string }> => {
  const pdfConcurrency = clampPdfConcurrency(generationOptions.concurrency);
  const reportProgress = (progress: FestivalPdfProgress) => {
    generationOptions.onProgress?.(progress);
  };

  const { dayStartTime, getStageNameByNumber, logoUrl, stageNamesByNumber } = await loadFestivalPdfContext(jobId);

  const { data: artists, error: artistError } = await supabase
    .from('festival_artists')
    .select('*')
    .eq('job_id', jobId);
  if (artistError) throw artistError;

  const context: FestivalSectionContext = {
    jobId,
    jobTitle,
    dayStartTime,
    logoUrl,
    options,
    pdfConcurrency,
    reportProgress,
    getStageNameByNumber,
    stageNamesByNumber,
    artists: artists || [],
    stagePlotUrlsByArtistId: await loadStagePlotUrls(artists || [], pdfConcurrency),
  };

  // Sections run one after another: each already runs its own documents concurrently.
  const gear = await generateGearSection(context);
  const shifts = await generateFestivalShiftPdfs({
    jobId,
    jobTitle,
    dayStartTime,
    logoUrl,
    options,
    pdfConcurrency,
    reportProgress,
  });
  const artistTables = await generateArtistTablesSection(context);
  const artistSheets = await generateArtistRequirementsSection(context);
  const rfIem = await generateRfIemSection(context);
  const infrastructure = await generateInfrastructureSection(context);
  const weather = await generateWeatherSection(context);
  const missingRiders = await generateMissingRiderSection(context);
  const wiredMics = await generateWiredMicSection(context);

  reportProgress({ phase: 'merge', completed: 0, total: 3, label: 'Calculando paginas' });

  const sections = await buildBundleSections(
    { shifts, gear, artistTables, artistSheets, rfIem, infrastructure, wiredMics, weather, missingRiders },
    options,
    getStageNameByNumber,
  );

  if (sections.reduce((total, section) => total + section.pageCount, 0) === 0) {
    throw new Error('No content documents were generated. Please ensure at least one document type has data to include in the PDF.');
  }

  reportProgress({ phase: 'merge', completed: 1, total: 3, label: 'Creando indice' });

  const blob = await assembleFestivalBundle({
    artists: artists || [],
    jobId,
    jobTitle,
    logoUrl,
    reportProgress,
    sections,
  });

  return {
    blob,
    filename: customFilename || buildReadableFilename([jobTitle || 'Festival', 'Documentación completa']),
  };
};
