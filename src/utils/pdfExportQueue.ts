import { exportToPDF } from "./pdfExport";

export type PdfExportArgs = Parameters<typeof exportToPDF>;

export interface PdfExportMetadata {
  id?: string;
  title?: string;
  fileName?: string;
  createdAt?: number;
  autoDownload?: boolean;
}

export interface PdfExportRequest {
  args: PdfExportArgs;
  metadata?: PdfExportMetadata;
}

export type PdfExportQueueEvent =
  | { type: "queued"; job: PdfExportJob }
  | { type: "started"; job: PdfExportJob }
  | { type: "completed"; job: PdfExportJob; result: Blob }
  | { type: "failed"; job: PdfExportJob; error: unknown };

export type PdfExportQueueListener = (event: PdfExportQueueEvent) => void;

interface PdfExportJob extends PdfExportRequest {
  id: string;
}

class PdfExportQueue {
  private queue: PdfExportJob[] = [];
  private activeJob: PdfExportJob | null = null;
  private listeners = new Set<PdfExportQueueListener>();
  private settleMap = new Map<string, { resolve: (blob: Blob) => void; reject: (error: unknown) => void }>();
  private processor: (...args: PdfExportArgs) => Promise<Blob> = (...args) => exportToPDF(...args);

  enqueue(request: PdfExportRequest): Promise<Blob> {
    const job: PdfExportJob = {
      id: request.metadata?.id ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      args: request.args,
      metadata: {
        createdAt: Date.now(),
        ...request.metadata,
      },
    };

    return new Promise<Blob>((resolve, reject) => {
      this.queue.push(job);
      this.settleMap.set(job.id, { resolve, reject });
      this.emit({ type: "queued", job });
      this.processNext();
    });
  }

  subscribe(listener: PdfExportQueueListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get pending(): number {
    return this.queue.length + (this.activeJob ? 1 : 0);
  }

  setProcessorForTests(processor?: (...args: PdfExportArgs) => Promise<Blob>) {
    this.processor = processor ?? ((...args: PdfExportArgs) => exportToPDF(...args));
  }

  resetForTests() {
    this.queue = [];
    this.activeJob = null;
    this.settleMap.clear();
  }

  private emit(event: PdfExportQueueEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("pdfExportQueue listener error", error);
      }
    });
  }

  private async processNext() {
    if (this.activeJob || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift()!;
    this.activeJob = job;
    this.emit({ type: "started", job });

    try {
      const result = await this.processor(...job.args);
      this.emit({ type: "completed", job, result });
      this.resolveJob(job.id, result);
    } catch (error) {
      this.emit({ type: "failed", job, error });
      this.rejectJob(job.id, error);
    } finally {
      this.activeJob = null;
      if (typeof window !== "undefined") {
        // Defer to next tick to avoid blocking UI thread on mobile devices
        window.setTimeout(() => this.processNext(), 50);
      } else {
        setTimeout(() => this.processNext(), 50);
      }
    }
  }

  private resolveJob(id: string, blob: Blob) {
    const settle = this.settleMap.get(id);
    if (settle) {
      settle.resolve(blob);
      this.settleMap.delete(id);
    }
  }

  private rejectJob(id: string, error: unknown) {
    const settle = this.settleMap.get(id);
    if (settle) {
      settle.reject(error);
      this.settleMap.delete(id);
    }
  }
}

export const pdfExportQueue = new PdfExportQueue();

export const queuePdfExport = (request: PdfExportRequest): Promise<Blob> =>
  pdfExportQueue.enqueue(request);

export default pdfExportQueue;
