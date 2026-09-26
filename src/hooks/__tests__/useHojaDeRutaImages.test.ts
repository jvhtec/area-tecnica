// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";

const storageMocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => storageMocks),
    },
  },
}));

describe("useHojaDeRutaImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.remove.mockResolvedValue({ error: null });
    storageMocks.upload.mockResolvedValue({ error: null });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("force-hydrates the same server rows and discards a local image removal", async () => {
    const { result } = renderHook(() => useHojaDeRutaImages());
    const rows = [{
      id: "image-1",
      hoja_de_ruta_id: "hoja-1",
      image_path: "data:image/png;base64,cersisted",
      image_type: "venue",
      sort_order: 0,
    }];

    await act(async () => {
      await result.current.hydratePersistedImages("job-1", rows);
    });
    await waitFor(() => expect(result.current.imagePreviews.venue).toHaveLength(1));

    act(() => result.current.removeImage("venue", 0));
    expect(result.current.getRemovedImageIds()).toEqual(["image-1"]);

    await act(async () => {
      await result.current.hydratePersistedImages("job-1", rows, { force: true });
    });

    await waitFor(() => {
      expect(result.current.imagePreviews.venue).toEqual([rows[0].image_path]);
      expect(result.current.getRemovedImageIds()).toEqual([]);
      expect(result.current.isImageDirty).toBe(false);
    });
  });

  it("removes an uploaded object when conflict reload discards the unsaved image", async () => {
    const { result } = renderHook(() => useHojaDeRutaImages());
    const file = new File([new Uint8Array([1, 2, 3])], "venue.png", {
      type: "image/png",
    });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => index === 0 ? file : null,
    } as unknown as FileList;

    act(() => result.current.handleImageUpload("venue", files));
    let uploadedPath = "";
    await act(async () => {
      const savedRows = await result.current.prepareImagesForSave("job-1");
      uploadedPath = savedRows[0].image_path;
    });

    await act(async () => {
      await result.current.hydratePersistedImages("job-1", [], { force: true });
    });

    expect(storageMocks.remove).toHaveBeenCalledWith([uploadedPath]);
    expect(result.current.imagePreviews.venue).toEqual([]);
  });
});
