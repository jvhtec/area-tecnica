import { buildDeliveredDocIndex, classifyJobDocument } from "./docRules.ts";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

const doc = (file_path: string, file_name = "report.pdf") => ({ file_path, file_name });

Deno.test("calculator folders map to the required document they satisfy", () => {
  assertEquals(classifyJobDocument(doc("calculators/pesos/job-1/uuid-pesos.pdf")), ["sound:pesos"], "pesos");
  assertEquals(classifyJobDocument(doc("calculators/lista-material/sound/job-1/lista.pdf")), ["sound:lista_material"], "sound material list");
  assertEquals(classifyJobDocument(doc("calculators/lista-material/lights/job-1/lista.pdf")), [], "lights material list is not required");
  assertEquals(classifyJobDocument(doc("calculators/sv-report/job-1/sv.pdf")), ["sound:soundvision"], "SoundVision report");
  assertEquals(classifyJobDocument(doc("calculators/lights-consumos/job-1/consumos.pdf")), ["lights:consumos"], "lights consumos");
});

Deno.test("shared Consumos folder is split by file name like the app does", () => {
  assertEquals(classifyJobDocument(doc("calculators/consumos/job-1/a.pdf", "Video Power Report - Gala.pdf")), ["video:consumos"], "video report");
  assertEquals(classifyJobDocument(doc("calculators/consumos/job-1/a.pdf", "consumos_video_gala.pdf")), ["video:consumos"], "_video_ marker");
  assertEquals(classifyJobDocument(doc("calculators/consumos/job-1/a.pdf", "Sound Power Report.pdf")), ["sound:consumos"], "sound report");
  assertEquals(classifyJobDocument(doc("calculators/consumos/job-1/a.pdf", "consumos.pdf")), ["sound:consumos"], "unlabelled defaults to sound");
});

Deno.test("job-scoped copies and loose uploads are handled", () => {
  assertEquals(classifyJobDocument(doc("job-1/calculators/pesos/stage-2/pesos.pdf")), ["sound:pesos"], "job-scoped layout");
  assertEquals(classifyJobDocument(doc("sound/job-1/rider.pdf")), [], "a rider upload is not a required document");
  assertEquals(classifyJobDocument({ file_path: null, file_name: null }), [], "null paths are ignored");
});

Deno.test("memorias count only once their final document exists", () => {
  const index = buildDeliveredDocIndex(
    [{ job_id: "job-1", ...doc("calculators/pesos/job-1/p.pdf") }],
    {
      sound: [{ job_id: "job-1", final_document_url: "https://example.test/memoria.pdf" }],
      lights: [{ job_id: "job-1", final_document_url: null }, { job_id: "job-2", final_document_url: "  " }],
      video: [{ job_id: null, final_document_url: "https://example.test/v.pdf" }],
    },
  );

  assertEquals([...(index.get("job-1") ?? [])].sort(), ["sound:memoria", "sound:pesos"], "delivered set for job-1");
  assertEquals(index.has("job-2"), false, "blank final documents do not count");
});
