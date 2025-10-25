import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveMainFlexElementId,
  getMainFlexElementIdSync,
  JobWithFlexFolders,
  FlexFolder,
} from "./flexMainFolderId";
import { supabase } from "@/lib/supabase";

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("flexMainFolderId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getMainFlexElementIdSync", () => {
    it("should return null when job has no flex_folders", () => {
      const job: JobWithFlexFolders = { id: "job-1" };
      expect(getMainFlexElementIdSync(job)).toBeNull();
    });

    it("should return null when flex_folders is an empty array", () => {
      const job: JobWithFlexFolders = { id: "job-1", flex_folders: [] };
      expect(getMainFlexElementIdSync(job)).toBeNull();
    });

    it("should prefer main_event folder type", () => {
      const job: JobWithFlexFolders = {
        id: "job-1",
        flex_folders: [
          {
            id: "folder-1",
            element_id: "element-main",
            department: null,
            folder_type: "main",
          },
          {
            id: "folder-2",
            element_id: "element-main-event",
            department: null,
            folder_type: "main_event",
          },
        ],
      };
      const result = getMainFlexElementIdSync(job);
      expect(result).toEqual({
        elementId: "element-main-event",
        department: null,
      });
    });

    it("should fall back to main folder type when main_event is not present", () => {
      const job: JobWithFlexFolders = {
        id: "job-1",
        flex_folders: [
          {
            id: "folder-1",
            element_id: "element-main",
            department: "sound",
            folder_type: "main",
          },
          {
            id: "folder-2",
            element_id: "element-dept",
            department: "sound",
            folder_type: "department",
          },
        ],
      };
      const result = getMainFlexElementIdSync(job);
      expect(result).toEqual({
        elementId: "element-main",
        department: "sound",
      });
    });

    it("should return null when no main or main_event folder exists", () => {
      const job: JobWithFlexFolders = {
        id: "job-1",
        flex_folders: [
          {
            id: "folder-1",
            element_id: "element-dept",
            department: "sound",
            folder_type: "department",
          },
        ],
      };
      expect(getMainFlexElementIdSync(job)).toBeNull();
    });
  });

  describe("resolveMainFlexElementId", () => {
    it("should return main_event from job.flex_folders when present", async () => {
      const job: JobWithFlexFolders = {
        id: "job-1",
        flex_folders: [
          {
            id: "folder-1",
            element_id: "element-main-event",
            department: null,
            folder_type: "main_event",
          },
        ],
      };

      const result = await resolveMainFlexElementId(job);
      expect(result).toEqual({
        elementId: "element-main-event",
        department: null,
      });

      // Should not call Supabase
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should fall back to main from job.flex_folders when main_event is not present", async () => {
      const job: JobWithFlexFolders = {
        id: "job-1",
        flex_folders: [
          {
            id: "folder-1",
            element_id: "element-main",
            department: "lights",
            folder_type: "main",
          },
        ],
      };

      const result = await resolveMainFlexElementId(job);
      expect(result).toEqual({
        elementId: "element-main",
        department: "lights",
      });

      // Should not call Supabase
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should query Supabase when flex_folders is missing", async () => {
      const job: JobWithFlexFolders = { id: "job-1" };

      const mockData = {
        element_id: "element-from-db",
        department: "video",
      };

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const mockLimit = vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockIn = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockEq = vi.fn().mockReturnValue({
        in: mockIn,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await resolveMainFlexElementId(job);

      expect(result).toEqual({
        elementId: "element-from-db",
        department: "video",
      });

      expect(supabase.from).toHaveBeenCalledWith("flex_folders");
      expect(mockSelect).toHaveBeenCalledWith("element_id, department");
      expect(mockEq).toHaveBeenCalledWith("job_id", "job-1");
      expect(mockIn).toHaveBeenCalledWith("folder_type", ["main_event", "main"]);
      expect(mockOrder).toHaveBeenCalledWith("folder_type", { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    it("should return null when Supabase query returns no data", async () => {
      const job: JobWithFlexFolders = { id: "job-1", flex_folders: [] };

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockLimit = vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockIn = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockEq = vi.fn().mockReturnValue({
        in: mockIn,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const result = await resolveMainFlexElementId(job);

      expect(result).toBeNull();
    });

    it("should return null and log error when Supabase query fails", async () => {
      const job: JobWithFlexFolders = { id: "job-1", flex_folders: [] };

      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const mockLimit = vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockOrder = vi.fn().mockReturnValue({
        limit: mockLimit,
      });

      const mockIn = vi.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockEq = vi.fn().mockReturnValue({
        in: mockIn,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await resolveMainFlexElementId(job);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching main Flex folder from Supabase:",
        { message: "Database error" }
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle exceptions gracefully", async () => {
      const job: JobWithFlexFolders = { id: "job-1", flex_folders: [] };

      vi.mocked(supabase.from).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await resolveMainFlexElementId(job);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Exception while resolving main Flex element ID:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
