import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requireMemoriaContext, uploadGeneratedMemoriaPdf } from "./memoriaSecurity.ts";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), auth: vi.fn() }));
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: mocks.createClient }));
vi.mock("./auth.ts", () => ({ requireAuthenticatedRole: mocks.auth }));
beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: (key: string) => key === "SUPABASE_URL" ? "https://project.supabase.co" : "fixture-server-key" } });
  mocks.createClient.mockReturnValue({});
  mocks.auth.mockResolvedValue({ userId: "caller" });
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const request = (body: unknown) => new Request("https://example.test", { method: "POST", body: JSON.stringify(body) });
const input = { projectName: "Evento", documentUrls: { material: "https://project.supabase.co/storage/v1/object/sign/memoria-tecnica/a.pdf?token=fixture" } };
it("authenticates the narrow role set before accepting a bounded request", async () => {
  await expect(requireMemoriaContext(request(input), ["material"], "memoria")).resolves.toMatchObject({ userId: "caller", projectName: "Evento" });
  expect(mocks.auth).toHaveBeenCalledWith({}, expect.any(Request), { allowedRoles: ["admin", "management", "house_tech"], logContext: "memoria" });
});
it("propagates denied authorization and rejects oversized input", async () => {
  mocks.auth.mockRejectedValueOnce(new Error("denied"));
  await expect(requireMemoriaContext(request(input), [], "memoria")).rejects.toThrow("denied");
  await expect(requireMemoriaContext(request({ ...input, padding: "x".repeat(25000) }), [], "memoria")).rejects.toMatchObject({ status: 413 });
});
function storage(uploadError: Error | null = null, signed: { data: { signedUrl: string } | null; error: Error | null } = { data: { signedUrl: "https://project.supabase.co/signed" }, error: null }) {
  const upload = vi.fn().mockResolvedValue({ error: uploadError });
  const createSignedUrl = vi.fn().mockResolvedValue(signed);
  const from = vi.fn((_bucket: string) => ({ upload, createSignedUrl }));
  return { client: { storage: { from } } as Parameters<typeof uploadGeneratedMemoriaPdf>[0], from, upload, createSignedUrl };
}
it("uploads without overwrite, uses a bounded signed URL and sanitizes object paths", async () => {
  const s = storage();
  const result = await uploadGeneratedMemoriaPdf(s.client, "../Féstival / Norte", "report.pdf", new Uint8Array([1]));
  expect(result).toMatchObject({ expiresIn: 3600, fileName: "report.pdf", url: "https://project.supabase.co/signed" });
  expect(s.upload).toHaveBeenCalledWith(expect.stringMatching(/generated\/[\w-]+\.pdf$/), expect.any(Uint8Array), { contentType: "application/pdf", upsert: false });
  expect(s.createSignedUrl).toHaveBeenCalledWith(expect.any(String), 3600);
});
it("tries the next output bucket and handles an empty sanitized project name", async () => {
  const s = storage(); s.upload.mockResolvedValueOnce({ error: new Error("missing bucket") });
  await uploadGeneratedMemoriaPdf(s.client, "!!!", "report.pdf", new Uint8Array());
  expect(s.from.mock.calls.map(call => call[0])).toEqual(["Memoria Tecnica", "memoria-tecnica", "memoria-tecnica"]);
  expect(s.upload).toHaveBeenCalledWith(expect.stringMatching(/^proyecto\/generated\//), expect.any(Uint8Array), expect.any(Object));
});
it("fails closed when every upload fails or no bucket is available", async () => {
  const s = storage(new Error("private detail"));
  await expect(uploadGeneratedMemoriaPdf(s.client, "Evento", "a.pdf", new Uint8Array())).rejects.toMatchObject({ status: 500, code: "output_upload_failed", exposeDetails: false });
  await expect(uploadGeneratedMemoriaPdf(s.client, "Evento", "a.pdf", new Uint8Array(), { bucketCandidates: [] })).rejects.toMatchObject({ code: "output_upload_failed" });
});
it("does not return an unsigned or failed storage result", async () => {
  for (const signed of [{ data: null, error: null }, { data: null, error: new Error("signing detail") }]) {
    const s = storage(null, signed);
    await expect(uploadGeneratedMemoriaPdf(s.client, "Evento", "a.pdf", new Uint8Array())).rejects.toMatchObject({ status: 500, code: "output_sign_failed", exposeDetails: false });
  }
});
