import type { FestivalArtistRow } from "@/features/festival-print/reportData";
import type { PrintOptions } from "@/features/festival-print/model";
import {
  runWithConcurrency,
  type FestivalPdfProgress,
  type FestivalPdfProgressPhase,
} from "@/utils/pdf/festivalPdfSupport";
import { trackError } from "@/lib/errorTracking";

/** What every section of the festival documentation bundle is generated from. */
export interface FestivalSectionContext {
  jobId: string;
  jobTitle: string;
  dayStartTime: string;
  logoUrl: string | undefined;
  options: PrintOptions;
  pdfConcurrency: number;
  reportProgress: (progress: FestivalPdfProgress) => void;
  getStageNameByNumber: (stage: number) => string;
  stageNamesByNumber: Record<number, string>;
  /** Every artist of the festival; each section filters it to its own stages. */
  artists: FestivalArtistRow[];
  stagePlotUrlsByArtistId: Record<string, string>;
}

interface ProgressLabels {
  preparing: string;
  running: string;
}

/**
 * Runs one job per item with the bundle's concurrency and reports progress as jobs finish. A job
 * that fails (or yields nothing) is `null` and is left out of the bundle rather than aborting it.
 */
export async function runProgressJobs<T, R>(
  context: FestivalSectionContext,
  phase: FestivalPdfProgressPhase,
  labels: ProgressLabels,
  items: readonly T[],
  job: (item: T, index: number) => Promise<R | null>,
): Promise<(R | null)[]> {
  let completed = 0;
  context.reportProgress({ phase, completed, total: items.length, label: labels.preparing });

  return runWithConcurrency(
    items,
    async (item, index) => {
      try {
        return await job(item, index);
      } catch (error) {
        void trackError(error, { system: "festivals", operation: `bundle-${phase}`, jobId: context.jobId });
        return null;
      } finally {
        completed += 1;
        context.reportProgress({ phase, completed, total: items.length, label: labels.running });
      }
    },
    context.pdfConcurrency,
  );
}

/** Runs a single-document section: a failure is reported and the section is left out. */
export async function attemptSection<R>(
  context: FestivalSectionContext,
  operation: string,
  build: () => Promise<R | null>,
): Promise<R | null> {
  try {
    return await build();
  } catch (error) {
    void trackError(error, { system: "festivals", operation, jobId: context.jobId });
    return null;
  }
}
