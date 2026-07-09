import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

import {
  buildCopiedSoundDocumentPath,
  duplicateSoundDocumentation,
  renameCopiedSoundDocumentFile,
  selectSoundDocumentsForCopy,
} from "@/utils/duplicateSoundDocumentation";

type TableName = "job_documents" | "power_requirement_tables" | "memoria_tecnica_documents";

type FakeTables = Record<TableName, Array<Record<string, unknown>>>;

const createPdfBlob = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return new Blob([arrayBuffer], { type: "application/pdf" });
};

const createFakeClient = (tables: FakeTables, storageEntries: Record<string, Blob>) => {
  const uploads: Array<{ bucket: string; path: string; blob: Blob; options: unknown }> = [];

  const applyFilters = (
    rows: Array<Record<string, unknown>>,
    filters: Array<{ column: string; value: unknown }>
  ) =>
    rows.filter((row) => filters.every((filter) => row[filter.column] === filter.value));

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from: vi.fn((table: TableName) => {
      const filters: Array<{ column: string; value: unknown }> = [];
      let mode: "select" | "delete" | "insert" = "select";
      let insertPayload: unknown;
      let orderColumn: string | null = null;
      let ascending = true;

      const builder = {
        delete: vi.fn(() => {
          mode = "delete";
          return builder;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          filters.push({ column, value });
          return builder;
        }),
        insert: vi.fn((payload: unknown) => {
          mode = "insert";
          insertPayload = payload;
          return builder;
        }),
        is: vi.fn((column: string, value: unknown) => {
          filters.push({ column, value });
          return builder;
        }),
        order: vi.fn((column: string, options?: { ascending?: boolean }) => {
          orderColumn = column;
          ascending = options?.ascending !== false;
          return builder;
        }),
        select: vi.fn(() => {
          mode = "select";
          return builder;
        }),
        then: (resolve: (value: { data: unknown; error: null }) => void) => {
          if (mode === "insert") {
            const payloadRows = Array.isArray(insertPayload) ? insertPayload : [insertPayload];
            tables[table].push(...(payloadRows as Array<Record<string, unknown>>));
            return Promise.resolve({ data: payloadRows, error: null }).then(resolve);
          }

          if (mode === "delete") {
            const toDelete = new Set(applyFilters(tables[table], filters));
            tables[table] = tables[table].filter((row) => !toDelete.has(row));
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }

          let rows = applyFilters(tables[table], filters);
          if (orderColumn) {
            rows = [...rows].sort((a, b) => {
              const av = String(a[orderColumn!] ?? "");
              const bv = String(b[orderColumn!] ?? "");
              return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
            });
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };

      return builder;
    }),
    storage: {
      from: vi.fn((bucket: string) => ({
        download: vi.fn(async (path: string) => ({
          data: storageEntries[`${bucket}:${path}`] || null,
          error: storageEntries[`${bucket}:${path}`] ? null : { message: "not found" },
        })),
        upload: vi.fn(async (path: string, blob: Blob, options: unknown) => {
          uploads.push({ bucket, path, blob, options });
          storageEntries[`${bucket}:${path}`] = blob;
          return { data: {}, error: null };
        }),
      })),
    },
  };

  return { client, uploads };
};

describe("duplicate sound documentation helpers", () => {
  it("renames copied files and preserves the source stage scope in the target path", () => {
    expect(
      renameCopiedSoundDocumentFile({
        sourceFileName: "SoundVision_Report_Source_Show.pdf",
        sourceJobTitle: "Source Show",
        targetJobTitle: "Target Show",
      })
    ).toBe("SoundVision_Report_Target_Show.pdf");

    expect(
      buildCopiedSoundDocumentPath({
        idFactory: () => "copy-id",
        sourceFilePath: "calculators/consumos/source-job/stage-2-main/source.pdf",
        sourceJobId: "source-job",
        targetFileName: "Sound Power Report - Target Show.pdf",
        targetJobId: "target-job",
      })
    ).toBe("calculators/consumos/target-job/stage-2-main/copy-id-Sound_Power_Report_-_Target_Show.pdf");

    expect(
      buildCopiedSoundDocumentPath({
        idFactory: () => "copy-id",
        jobScopedStorage: true,
        sourceFilePath: "calculators/consumos/source-job/stage-2-main/source.pdf",
        sourceJobId: "source-job",
        targetFileName: "Sound Power Report - Target Show.pdf",
        targetJobId: "target-job",
      })
    ).toBe("target-job/calculators/consumos/stage-2-main/copy-id-Sound_Power_Report_-_Target_Show.pdf");
  });

  it("selects generic sound docs and only the latest generated sound docs per category scope", () => {
    const docs = [
      {
        id: "task-doc",
        file_name: "Task.pdf",
        file_path: "sound/source-job/task-1/Task.pdf",
        uploaded_at: "2026-01-05T00:00:00Z",
      },
      {
        id: "generic-doc",
        file_name: "Patch.pdf",
        file_path: "sound/source-job/Patch.pdf",
        uploaded_at: "2026-01-05T00:00:00Z",
      },
      {
        id: "old-power",
        file_name: "Sound Power Report - Source.pdf",
        file_path: "calculators/consumos/source-job/report-old.pdf",
        uploaded_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "new-power",
        file_name: "Sound Power Report - Source.pdf",
        file_path: "calculators/consumos/source-job/report-new.pdf",
        uploaded_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "job-scoped-power",
        file_name: "Sound Power Report - Source.pdf",
        file_path: "source-job/calculators/consumos/report-copy.pdf",
        uploaded_at: "2026-01-06T00:00:00Z",
      },
      {
        id: "video-power",
        file_name: "Video Power Report - Source.pdf",
        file_path: "calculators/consumos/source-job/video.pdf",
        uploaded_at: "2026-01-03T00:00:00Z",
      },
      {
        id: "material",
        file_name: "Lista de material - sound.pdf",
        file_path: "calculators/lista-material/sound/source-job/lista.pdf",
        uploaded_at: "2026-01-04T00:00:00Z",
      },
      {
        id: "template",
        file_name: "Venue.xmls",
        file_path: "soundvision-files/venues/venue.xmls",
        uploaded_at: "2026-01-04T00:00:00Z",
        template_type: "soundvision",
      },
    ].map((doc) => ({
      ...doc,
      file_size: 1,
      file_type: "application/pdf",
      original_type: "pdf",
      read_only: false,
      template_type: doc.template_type ?? null,
      uploaded_by: null as string | null,
      visible_to_tech: true,
    }));

    const selected = selectSoundDocumentsForCopy(docs, "source-job", [
      "soundDocuments",
      "power",
      "material",
      "soundvision",
    ]);

    expect(selected.map((item) => item.doc.id).sort()).toEqual([
      "generic-doc",
      "job-scoped-power",
      "material",
      "template",
    ]);
  });
});

describe("duplicateSoundDocumentation", () => {
  it("copies documents and replaces target sound power/memoria rows from the source job", async () => {
    const blob = await createPdfBlob();
    const sourcePdfSize = blob.size;
    const tables: FakeTables = {
      job_documents: [
        {
          id: "generic",
          job_id: "source-job",
          file_name: "Patch Source Show.pdf",
          file_path: "sound/source-job/Patch Source Show.pdf",
          file_size: 3,
          file_type: "application/pdf",
          original_type: "pdf",
          read_only: false,
          template_type: null,
          uploaded_at: "2026-01-01T00:00:00Z",
          uploaded_by: "source-user",
          visible_to_tech: true,
        },
        {
          id: "power",
          job_id: "source-job",
          file_name: "Sound Power Report - Source Show.pdf",
          file_path: "calculators/consumos/source-job/power.pdf",
          file_size: 3,
          file_type: "application/pdf",
          original_type: "pdf",
          read_only: false,
          template_type: null,
          uploaded_at: "2026-01-02T00:00:00Z",
          uploaded_by: "source-user",
          visible_to_tech: true,
        },
        {
          id: "template",
          job_id: "source-job",
          file_name: "Venue.xmls",
          file_path: "soundvision-files/venues/venue.xmls",
          file_size: 3,
          file_type: "application/octet-stream",
          original_type: null,
          read_only: true,
          template_type: "soundvision",
          uploaded_at: "2026-01-03T00:00:00Z",
          uploaded_by: "source-user",
          visible_to_tech: true,
        },
      ],
      power_requirement_tables: [
        {
          id: "source-power-row",
          job_id: "source-job",
          department: "sound",
          table_name: "FOH",
          total_watts: 1200,
          current_per_phase: 5,
          pdu_type: "32A",
          custom_pdu_type: null,
          position: "foh",
          custom_position: null,
          includes_hoist: false,
          table_data: { rows: [], generationTimestamp: "old" },
          stage_number: null,
          stage_name: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "target-power-row",
          job_id: "target-job",
          department: "sound",
          table_name: "Old",
          total_watts: 1,
          current_per_phase: 1,
          pdu_type: "16A",
          custom_pdu_type: null,
          position: null,
          custom_position: null,
          includes_hoist: false,
          table_data: {},
          stage_number: null,
          stage_name: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      memoria_tecnica_documents: [
        {
          id: "source-memoria",
          job_id: "source-job",
          project_name: "Source Show",
          stage_number: null,
          stage_name: null,
          final_document_url: "https://old.example/final.pdf",
          material_list_url: "https://old.example/material.pdf",
          soundvision_report_url: "https://old.example/sv.pdf",
          power_report_url: "https://old.example/power.pdf",
          weight_report_url: null,
          rigging_plot_url: null,
        },
        {
          id: "target-memoria",
          job_id: "target-job",
          project_name: "Old Target",
          final_document_url: "https://old.example/target.pdf",
        },
      ],
    };
    const storageEntries = {
      "job_documents:sound/source-job/Patch Source Show.pdf": blob,
      "job-documents:calculators/consumos/source-job/power.pdf": blob,
    };
    const { client, uploads } = createFakeClient(tables, storageEntries);
    const ids = ["copy-a", "copy-b"];

    const result = await duplicateSoundDocumentation({
      client: client as never,
      idFactory: () => ids.shift() || "fallback",
      sourceJobId: "source-job",
      sourceJobTitle: "Source Show",
      targetJobDate: "2026-02-14T20:00:00Z",
      targetJobId: "target-job",
      targetJobTitle: "Target Show",
    });

    expect(result).toMatchObject({
      copiedDocuments: 3,
      copiedMemoriaRows: 1,
      copiedPowerTables: 1,
      skippedDocuments: 0,
    });

    expect(uploads.map((upload) => `${upload.bucket}:${upload.path}`).sort()).toEqual([
      "job-documents:target-job/calculators/consumos/copy-a-Sound_Power_Report_-_Target_Show.pdf",
      "job_documents:sound/target-job/copy-b-Patch_Target_Show.pdf",
    ]);
    const powerUpload = uploads.find((upload) => upload.path.includes("target-job/calculators/consumos"));
    expect(powerUpload?.blob.size).toBeGreaterThan(sourcePdfSize);
    await expect(PDFDocument.load(await powerUpload!.blob.arrayBuffer())).resolves.toBeTruthy();

    const targetDocs = tables.job_documents.filter((row) => row.job_id === "target-job");
    expect(targetDocs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file_name: "Patch Target Show.pdf",
          file_path: "sound/target-job/copy-b-Patch_Target_Show.pdf",
          uploaded_by: "user-1",
        }),
        expect.objectContaining({
          file_name: "Sound Power Report - Target Show.pdf",
          file_path: "target-job/calculators/consumos/copy-a-Sound_Power_Report_-_Target_Show.pdf",
          uploaded_by: "user-1",
        }),
        expect.objectContaining({
          file_name: "Venue.xmls",
          file_path: "soundvision-files/venues/venue.xmls",
          read_only: true,
          template_type: "soundvision",
        }),
      ])
    );

    expect(tables.power_requirement_tables.filter((row) => row.job_id === "target-job")).toEqual([
      expect.objectContaining({
        department: "sound",
        job_id: "target-job",
        table_name: "FOH",
        total_watts: 1200,
      }),
    ]);

    expect(tables.memoria_tecnica_documents.filter((row) => row.job_id === "target-job")).toEqual([
      expect.objectContaining({
        project_name: "Target Show",
        final_document_url: null,
        material_list_url: null,
        soundvision_report_url: null,
        power_report_url: null,
      }),
    ]);
  });
});
