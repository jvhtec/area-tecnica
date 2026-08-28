import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  invalidateQueriesMock,
  syncFlexElementsMock,
  toastMock,
} = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  syncFlexElementsMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/useLocationManagement", () => ({
  useLocationManagement: () => ({
    getOrCreateLocationWithDetails: vi.fn(),
  }),
}));

vi.mock("@/utils/flex-folders/syncDateChange", () => ({
  haveJobDatesChanged: (
    previousStart: string,
    previousEnd: string,
    nextStart: string,
    nextEnd: string
  ) =>
    new Date(previousStart).getTime() !== new Date(nextStart).getTime() ||
    new Date(previousEnd).getTime() !== new Date(nextEnd).getTime(),
  syncFlexElementsForJobDateChange: syncFlexElementsMock,
}));

vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResponsiveDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: (): null => null,
}));

vi.mock("@/components/maps/PlaceAutocomplete", () => ({
  PlaceAutocomplete: (): null => null,
}));

vi.mock("@/components/jobs/SimplifiedJobColorPicker", () => ({
  SimplifiedJobColorPicker: (): null => null,
}));

vi.mock("@/components/jobs/JobRequirementsEditor", () => ({
  JobRequirementsEditor: (): null => null,
}));

vi.mock("@/services/dataLayerClient", () => {
  class MockQueryBuilder {
    private table: string;
    private action = "select";

    constructor(table: string) {
      this.table = table;
    }

    select() {
      this.action = "select";
      return this;
    }

    update() {
      this.action = "update";
      return this;
    }

    upsert() {
      this.action = "upsert";
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    eq() {
      return this;
    }

    in() {
      return this;
    }

    order() {
      return this;
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      let result: unknown = { data: null, error: null };
      if (this.action === "select" && this.table === "job_departments") {
        result = { data: [{ department: "sound" }], error: null };
      } else if (this.action === "select" && this.table === "job_date_types") {
        result = { data: [], error: null };
      }
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  return {
    dataLayerClient: {
      from: (table: string) => new MockQueryBuilder(table),
      rpc: vi.fn().mockResolvedValue({ error: null }),
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    },
  };
});

import { EditJobDialog } from "./EditJobDialog";

describe("EditJobDialog Flex synchronization", () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset();
    syncFlexElementsMock.mockReset();
    toastMock.mockReset();
  });

  it("closes after the app save without waiting for Flex", async () => {
    syncFlexElementsMock.mockReturnValue(new Promise(() => undefined));
    const onOpenChange = vi.fn();

    render(
      <EditJobDialog
        open
        onOpenChange={onOpenChange}
        job={{
          id: "job-1",
          title: "Old Job",
          description: "",
          start_time: "2026-02-03T10:00:00+00:00",
          end_time: "2026-02-03T20:00:00+00:00",
          timezone: "Europe/Madrid",
          job_type: "single",
          location_id: null,
          flex_folders_created: true,
          job_departments: [{ department: "sound" }],
        }}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New Job" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(syncFlexElementsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
