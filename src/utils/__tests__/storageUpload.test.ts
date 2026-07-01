import { beforeEach, describe, expect, it, vi } from "vitest";

type MockTusOptions = {
  endpoint: string;
  retryDelays: number[];
  headers: Record<string, string>;
  metadata: Record<string, string>;
  chunkSize: number;
  uploadDataDuringCreation: boolean;
  removeFingerprintOnSuccess: boolean;
  fingerprint?: (file: Blob) => Promise<string>;
  onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

const mocks = vi.hoisted(() => {
  const uploadInstances: Array<{
    file: Blob;
    options: MockTusOptions;
    findPreviousUploads: ReturnType<typeof vi.fn>;
    resumeFromPreviousUpload: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  }> = [];

  class MockUpload {
    file: Blob;
    options: MockTusOptions;
    findPreviousUploads = vi.fn(() => Promise.resolve([]));
    resumeFromPreviousUpload = vi.fn();
    start = vi.fn(() => {
      this.options.onProgress?.(this.file.size, this.file.size);
      this.options.onSuccess?.();
    });

    constructor(file: Blob, options: MockTusOptions) {
      this.file = file;
      this.options = options;
      uploadInstances.push(this);
    }
  }

  return {
    authGetSession: vi.fn(),
    storageFrom: vi.fn(),
    storageUpload: vi.fn(),
    uploadInstances,
    MockUpload,
  };
});

vi.mock("@/lib/api-config", () => ({
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

vi.mock("tus-js-client", () => ({
  Upload: mocks.MockUpload,
}));

import {
  RESUMABLE_UPLOAD_THRESHOLD_BYTES,
  uploadStorageObject,
} from "@/utils/storageUpload";

const makeSupabase = () => ({
  auth: {
    getSession: mocks.authGetSession,
  },
  storage: {
    from: mocks.storageFrom,
  },
}) as unknown as Parameters<typeof uploadStorageObject>[0];

const makeNamedBlob = (size: number, name: string, type = "application/octet-stream") =>
  Object.assign(new Blob([new Uint8Array(size)], { type }), {
    name,
    lastModified: 1234,
  });

describe("storageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadInstances.length = 0;
    mocks.authGetSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
      error: null,
    });
    mocks.storageFrom.mockReturnValue({
      upload: mocks.storageUpload,
    });
    mocks.storageUpload.mockResolvedValue({ error: null });
  });

  it("uses the normal Supabase upload API below the resumable threshold", async () => {
    const file = makeNamedBlob(1024, "small.dwg", "application/acad");
    const onProgress = vi.fn();

    await uploadStorageObject(makeSupabase(), {
      bucket: "plans",
      path: "jobs/job-1/small.dwg",
      file,
      contentType: "application/dwg",
      onProgress,
    });

    expect(mocks.storageFrom).toHaveBeenCalledWith("plans");
    expect(mocks.storageUpload).toHaveBeenCalledWith("jobs/job-1/small.dwg", file, {
      cacheControl: "3600",
      contentType: "application/dwg",
      upsert: false,
    });
    expect(mocks.uploadInstances).toHaveLength(0);
    expect(onProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percentage: 100,
    });
  });

  it("uses Supabase resumable uploads for large authenticated files", async () => {
    const file = makeNamedBlob(RESUMABLE_UPLOAD_THRESHOLD_BYTES, "large.dwg", "application/acad");
    const onProgress = vi.fn();

    await uploadStorageObject(makeSupabase(), {
      bucket: "plans",
      path: "jobs/job-1/large.dwg",
      file,
      upsert: true,
      onProgress,
    });

    expect(mocks.storageUpload).not.toHaveBeenCalled();
    expect(mocks.authGetSession).toHaveBeenCalledTimes(1);
    expect(mocks.uploadInstances).toHaveLength(1);

    const { options } = mocks.uploadInstances[0];
    expect(options.endpoint).toBe("https://project-ref.storage.supabase.co/storage/v1/upload/resumable");
    expect(options.headers).toMatchObject({
      apikey: "anon-key",
      authorization: "Bearer session-token",
      "x-upsert": "true",
    });
    expect(options.metadata).toMatchObject({
      bucketName: "plans",
      objectName: "jobs/job-1/large.dwg",
      contentType: "application/acad",
      cacheControl: "3600",
    });
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.uploadDataDuringCreation).toBe(true);
    expect(options.removeFingerprintOnSuccess).toBe(true);
    expect(onProgress).toHaveBeenCalledWith({
      bytesUploaded: file.size,
      bytesTotal: file.size,
      percentage: 100,
    });
  });

  it("uses signed resumable uploads without requiring an authenticated session", async () => {
    const file = makeNamedBlob(RESUMABLE_UPLOAD_THRESHOLD_BYTES, "public-rider.dwg", "application/acad");

    await uploadStorageObject(makeSupabase(), {
      bucket: "festival_artist_files",
      path: "artist-1/public-rider.dwg",
      file,
      signedUploadToken: "signed-token",
    });

    expect(mocks.authGetSession).not.toHaveBeenCalled();
    expect(mocks.uploadInstances).toHaveLength(1);

    const { options } = mocks.uploadInstances[0];
    expect(options.endpoint).toBe("https://project-ref.supabase.co/storage/v1/upload/resumable/sign");
    expect(options.headers).toEqual({
      apikey: "anon-key",
      "x-signature": "signed-token",
    });
    await expect(options.fingerprint?.(file)).resolves.toContain("artist-1/public-rider.dwg");
  });
});
