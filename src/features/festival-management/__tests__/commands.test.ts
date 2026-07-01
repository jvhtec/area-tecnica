import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbInsert: vi.fn(),
  getUser: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
    from: vi.fn(() => ({
      insert: mocks.dbInsert,
    })),
    storage: {
      from: mocks.storageFrom,
    },
  },
}));

import { resolveJobDocLocation } from "@/utils/jobDocuments";
import { uploadJobDocument } from "@/features/festival-management/commands";

describe("uploadJobDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      remove: mocks.storageRemove,
    });
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.dbInsert.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("uploads to the same bucket resolveJobDocLocation resolves for the stored path", async () => {
    const file = new File(["contenido"], "rider.pdf", { type: "application/pdf" });

    await uploadJobDocument({ file, jobId: "job-1" });

    const [uploadBucket] = mocks.storageFrom.mock.calls[0];
    const [objectPath] = mocks.storageUpload.mock.calls[0];

    expect(objectPath).toBe("job-1/rider.pdf");
    expect(uploadBucket).toBe("job-documents");

    // Any later view/download/delete of this row resolves its bucket from the
    // stored file_path alone. If the upload bucket ever drifts from what this
    // resolves to, re-uploading a deleted file's name fails forever because
    // the real object never gets cleaned up from the bucket it actually lives in.
    expect(resolveJobDocLocation(objectPath).bucket).toBe(uploadBucket);
  });

  it("self-attributes the metadata row so non-management uploads pass RLS", async () => {
    const file = new File(["contenido"], "rider.pdf", { type: "application/pdf" });

    await uploadJobDocument({ file, jobId: "job-1" });

    // p_job_documents_public_insert only accepts rows where
    // uploaded_by = auth.uid() unless the caller is admin/management/logistics,
    // so house tech uploads 403 without this attribution.
    expect(mocks.dbInsert).toHaveBeenCalledWith(
      expect.objectContaining({ job_id: "job-1", uploaded_by: "user-1" }),
    );
  });
});
