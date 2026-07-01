import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbInsert: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
  storageUpload: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
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
  it("uploads to the same bucket resolveJobDocLocation resolves for the stored path", async () => {
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
      remove: mocks.storageRemove,
    });
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.dbInsert.mockResolvedValue({ error: null });

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
});
