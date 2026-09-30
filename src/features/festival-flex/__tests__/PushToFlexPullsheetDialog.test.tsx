// @vitest-environment jsdom
import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/createTestQueryClient";
import type { GearSetupFormData } from "@/types/festival-gear";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  trackError: vi.fn(),
  api: {
    fetchFlexResourceIdsByName: vi.fn(),
    fetchSoundPresets: vi.fn(),
    fetchPresetItems: vi.fn(),
  },
  getJobPullsheetsWithFlexApi: vi.fn(),
  pushEquipmentToPullsheet: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: mocks.toast }));
vi.mock("@/lib/errorTracking", () => ({ trackError: mocks.trackError }));
vi.mock("../api", () => mocks.api);
vi.mock("@/services/flexPullsheets", () => ({
  getJobPullsheetsWithFlexApi: mocks.getJobPullsheetsWithFlexApi,
  pushEquipmentToPullsheet: mocks.pushEquipmentToPullsheet,
}));

import { PushToFlexPullsheetDialog } from "@/components/festival/PushToFlexPullsheetDialog";

const gearSetup = {
  foh_consoles: [{ model: "SD12", quantity: 1 }],
  mon_consoles: [],
  wireless_systems: [{ model: "AD4Q", quantity_ch: 4 }],
  iem_systems: [],
  wired_mics: [{ model: "SM58", quantity: 10 }],
} as unknown as GearSetupFormData;

const pullsheet = { id: "p1", element_id: "elem-1", department: "sound", created_at: "2026-07-01T10:00:00Z", display_name: "Sonido" };

const renderDialog = (overrides: Partial<React.ComponentProps<typeof PushToFlexPullsheetDialog>> = {}) => {
  const onOpenChange = vi.fn();
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <PushToFlexPullsheetDialog open onOpenChange={onOpenChange} gearSetup={gearSetup} jobId="job-1" {...overrides} />
    </QueryClientProvider>,
  );
  return { onOpenChange };
};

describe("PushToFlexPullsheetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.fetchFlexResourceIdsByName.mockResolvedValue(
      new Map([
        ["SD12", "res-sd12"],
        ["SM58", "res-sm58"],
      ]),
    );
    mocks.api.fetchSoundPresets.mockResolvedValue([]);
    mocks.api.fetchPresetItems.mockResolvedValue([]);
    mocks.getJobPullsheetsWithFlexApi.mockResolvedValue([pullsheet]);
    mocks.pushEquipmentToPullsheet.mockResolvedValue({ succeeded: 2, failed: [] });
  });

  it("previews what will be pushed and what has no Flex resource", async () => {
    renderDialog();

    expect(await screen.findByText(/Listo para enviar 2 artículos \(11 unidades en total\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 artículos se omitirán/)).toBeInTheDocument();
    expect(screen.getByText("AD4Q")).toBeInTheDocument();
  });

  it("selects the only pullsheet for the user and pushes the matched equipment to it", async () => {
    renderDialog();
    const button = await screen.findByRole("button", { name: /Enviar artículos/ });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    await waitFor(() => expect(mocks.pushEquipmentToPullsheet).toHaveBeenCalledTimes(1));
    const [elementId, items] = mocks.pushEquipmentToPullsheet.mock.calls[0];
    expect(elementId).toBe("elem-1");
    expect(items.map((item: { resourceId: string; quantity: number }) => [item.resourceId, item.quantity])).toEqual([
      ["res-sd12", 1],
      ["res-sm58", 10],
    ]);
    expect(await screen.findByText(/Se enviaron 2 artículos al pullsheet de Flex/)).toBeInTheDocument();
  });

  it("drops a section from the push when it is unticked", async () => {
    renderDialog();
    await screen.findByText(/Listo para enviar 2 artículos/);

    fireEvent.click(screen.getByLabelText("Microfonía Cableada"));

    expect(await screen.findByText(/Listo para enviar 1 artículos \(1 unidades en total\)/)).toBeInTheDocument();
  });

  it("falls back to the URL tab when the job has no pullsheets, and needs a valid Flex URL", async () => {
    mocks.getJobPullsheetsWithFlexApi.mockResolvedValue([]);
    renderDialog();

    const input = await screen.findByPlaceholderText(/Pega aquí la URL/);
    const button = screen.getByRole("button", { name: /Enviar artículos/ });
    await screen.findByText(/Listo para enviar/);
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "https://nope.example/x" } });
    expect(screen.getByText("Formato de URL de Flex no válido")).toBeInTheDocument();
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "https://flex.example.com/app/element/3f2a1b4c-1111-2222-3333-444455556666" } });
    expect(button).toBeEnabled();
  });

  it("shows the loading state, not the URL box, while the job's pullsheets load", async () => {
    mocks.getJobPullsheetsWithFlexApi.mockReturnValue(new Promise(() => undefined));
    renderDialog();

    expect(await screen.findByText("Cargando pullsheets...")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Pega aquí la URL/)).not.toBeInTheDocument();
  });

  it("keeps a URL being typed as the target when the job's pullsheets arrive late", async () => {
    let resolvePullsheets: (value: unknown[]) => void = () => undefined;
    mocks.getJobPullsheetsWithFlexApi.mockReturnValue(new Promise((resolve) => (resolvePullsheets = resolve)));
    renderDialog();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Introducir URL/ }), { button: 0 });
    const url = "https://flex.example.com/app/element/3f2a1b4c-1111-2222-3333-444455556666";
    fireEvent.change(await screen.findByPlaceholderText(/Pega aquí la URL/), { target: { value: url } });

    resolvePullsheets([pullsheet, { ...pullsheet, id: "p2", element_id: "elem-2" }]);

    const button = screen.getByRole("button", { name: /Enviar artículos/ });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByPlaceholderText(/Pega aquí la URL/)).toHaveValue(url);
    fireEvent.click(button);
    await waitFor(() => expect(mocks.pushEquipmentToPullsheet).toHaveBeenCalled());
    expect(mocks.pushEquipmentToPullsheet.mock.calls[0][0]).toBe("3f2a1b4c-1111-2222-3333-444455556666");
  });

  it("does not push to a target or resources it is still refreshing after a reopen", async () => {
    const queryClient = createTestQueryClient();
    const tree = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <PushToFlexPullsheetDialog open={open} onOpenChange={vi.fn()} gearSetup={gearSetup} jobId="job-1" />
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    const button = await screen.findByRole("button", { name: /Enviar artículos/ });
    await waitFor(() => expect(button).toBeEnabled());

    rerender(tree(false));
    // The Flex side changed meanwhile; the fresh answer has not arrived yet.
    mocks.getJobPullsheetsWithFlexApi.mockReturnValue(new Promise(() => undefined));
    mocks.api.fetchFlexResourceIdsByName.mockReturnValue(new Promise(() => undefined));
    rerender(tree(true));

    expect(await screen.findByRole("button", { name: /Enviar artículos/ })).toBeDisabled();
  });

  it("does not push cached data when refreshing the pullsheets failed after a reopen", async () => {
    const queryClient = createTestQueryClient();
    const tree = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <PushToFlexPullsheetDialog open={open} onOpenChange={vi.fn()} gearSetup={gearSetup} jobId="job-1" />
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    await waitFor(() => expect(screen.getByRole("button", { name: /Enviar artículos/ })).toBeEnabled());

    rerender(tree(false));
    mocks.getJobPullsheetsWithFlexApi.mockRejectedValue(new Error("flex down"));
    rerender(tree(true));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByRole("button", { name: /Enviar artículos/ })).toBeDisabled();
  });

  it("does not push cached equipment when refreshing the Flex resources failed after a reopen", async () => {
    const queryClient = createTestQueryClient();
    const tree = (open: boolean) => (
      <QueryClientProvider client={queryClient}>
        <PushToFlexPullsheetDialog open={open} onOpenChange={vi.fn()} gearSetup={gearSetup} jobId="job-1" />
      </QueryClientProvider>
    );
    const { rerender } = render(tree(true));
    await waitFor(() => expect(screen.getByRole("button", { name: /Enviar artículos/ })).toBeEnabled());

    rerender(tree(false));
    mocks.api.fetchFlexResourceIdsByName.mockRejectedValue(new Error("db down"));
    rerender(tree(true));

    await waitFor(() => expect(mocks.api.fetchFlexResourceIdsByName).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })));
    expect(screen.getByRole("button", { name: /Enviar artículos/ })).toBeDisabled();
  });

  it("does not let a failed pullsheet list block pushing to a URL", async () => {
    mocks.getJobPullsheetsWithFlexApi.mockRejectedValue(new Error("flex down"));
    renderDialog();

    const input = await screen.findByPlaceholderText(/Pega aquí la URL/);
    fireEvent.change(input, { target: { value: "https://flex.example.com/app/element/3f2a1b4c-1111-2222-3333-444455556666" } });

    await waitFor(() => expect(screen.getByRole("button", { name: /Enviar artículos/ })).toBeEnabled());
  });

  it("reports items Flex refused", async () => {
    mocks.pushEquipmentToPullsheet.mockResolvedValue({ succeeded: 1, failed: [{ name: "SM58", error: "cantidad no válida" }] });
    renderDialog();
    const button = await screen.findByRole("button", { name: /Enviar artículos/ });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    expect(await screen.findByText(/1 artículos fallaron/)).toBeInTheDocument();
    expect(screen.getByText(/SM58: cantidad no válida/)).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Éxito parcial", variant: "destructive" }));
  });

  it("tells the user when the pullsheets cannot be loaded", async () => {
    mocks.getJobPullsheetsWithFlexApi.mockRejectedValue(new Error("flex down"));
    renderDialog();

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "No se pudieron cargar los pullsheets de este trabajo", variant: "destructive" }),
      ),
    );
    expect(mocks.trackError).toHaveBeenCalled();
  });

  it("adds the items of a chosen PA preset", async () => {
    mocks.api.fetchSoundPresets.mockResolvedValue([{ id: "pa-1", name: "PA Grande", job_id: "job-1" }]);
    mocks.api.fetchPresetItems.mockResolvedValue([
      { quantity: 8, subsystem: null, equipment: { id: "e", name: "Main", category: "pa_mains", resource_id: "res-main" } },
    ]);
    renderDialog();
    await screen.findByText(/Listo para enviar 2 artículos/);

    fireEvent.click(screen.getByLabelText("Incluir preset de PA"));
    fireEvent.click(await screen.findByLabelText("Preset de PA"));
    fireEvent.click(await screen.findByRole("option", { name: /PA Grande/ }));

    expect(await screen.findByText(/Listo para enviar 3 artículos \(19 unidades en total\)/)).toBeInTheDocument();
    expect(mocks.api.fetchPresetItems).toHaveBeenCalledWith("pa-1");
  });
});
