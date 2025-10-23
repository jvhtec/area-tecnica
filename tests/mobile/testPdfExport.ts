import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  queuePdfExport,
  pdfExportQueue,
  type PdfExportArgs,
} from "@/utils/pdfExportQueue";

describe("pdf export queue", () => {
  beforeEach(() => {
    pdfExportQueue.resetForTests();
  });

  afterEach(() => {
    pdfExportQueue.setProcessorForTests();
    pdfExportQueue.resetForTests();
  });

  const buildArgs = (title: string, type: PdfExportArgs[2]): PdfExportArgs => [
    title,
    [],
    type,
    title,
    new Date().toISOString(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ];

  it("processes exports sequentially", async () => {
    const processor = vi.fn(async (...args: PdfExportArgs) => {
      const payload = `${args[0]}-${args[2]}`;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Blob([payload], { type: "application/pdf" });
    });

    pdfExportQueue.setProcessorForTests((...args) => processor(...args));

    const p1 = queuePdfExport({ args: buildArgs("Project A", "weight"), metadata: { title: "Project A" } });
    const p2 = queuePdfExport({ args: buildArgs("Project B", "power"), metadata: { title: "Project B" } });

    const [blob1, blob2] = await Promise.all([p1, p2]);

    expect(blob1).toBeInstanceOf(Blob);
    expect(blob2).toBeInstanceOf(Blob);
    expect(processor).toHaveBeenCalledTimes(2);
    expect(processor.mock.calls[0][0]).toBe("Project A");
    expect(processor.mock.calls[1][0]).toBe("Project B");
    expect(processor.mock.invocationCallOrder[0]).toBeLessThan(
      processor.mock.invocationCallOrder[1]
    );
  });

  it("emits lifecycle events", async () => {
    const processor = vi.fn(async (...args: PdfExportArgs) => new Blob([args[0]], { type: "application/pdf" }));
    pdfExportQueue.setProcessorForTests((...args) => processor(...args));

    const events: string[] = [];
    const unsubscribe = pdfExportQueue.subscribe((event) => {
      events.push(event.type);
    });

    await queuePdfExport({ args: buildArgs("Lifecycle", "weight"), metadata: { title: "Lifecycle" } });

    unsubscribe();

    expect(events).toEqual(["queued", "started", "completed"]);
    expect(processor).toHaveBeenCalledTimes(1);
  });
});
