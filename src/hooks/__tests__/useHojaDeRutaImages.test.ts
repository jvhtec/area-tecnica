// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHojaDeRutaImages } from "@/hooks/useHojaDeRutaImages";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
        upload: vi.fn(),
      })),
    },
  },
}));

describe("useHojaDeRutaImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
