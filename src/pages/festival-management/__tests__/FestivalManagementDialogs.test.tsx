// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/renderWithProviders";

vi.mock("@/components/festival/scheduling/FestivalScheduling", () => ({
  FestivalScheduling: () => <div data-testid="festival-scheduling" />,
}));

vi.mock("@/components/festival/pdf/PrintOptionsDialog", () => ({
  PrintOptionsDialog: () => <div data-testid="print-options-dialog" />,
}));

vi.mock("@/components/flex/FlexFolderPicker", () => ({
  FlexFolderPicker: () => <div data-testid="flex-folder-picker" />,
}));

vi.mock("@/components/hoja-de-ruta/ModernHojaDeRuta", () => ({
  ModernHojaDeRuta: () => <div data-testid="modern-hoja-de-ruta" />,
}));

vi.mock("@/components/jobs/JobAssignmentDialog", () => ({
  JobAssignmentDialog: () => <div data-testid="job-assignment-dialog" />,
}));

vi.mock("@/components/jobs/JobDetailsDialog", () => ({
  JobDetailsDialog: () => <div data-testid="job-details-dialog" />,
}));

vi.mock("@/components/jobs/FlexSyncLogDialog", () => ({
  FlexSyncLogDialog: () => <div data-testid="flex-sync-log-dialog" />,
}));

vi.mock("@/components/jobs/JobPresetManagerDialog", () => ({
  JobPresetManagerDialog: () => <div data-testid="job-preset-manager-dialog" />,
}));

import { FestivalManagementDialogs } from "../FestivalManagementDialogs";

const baseVm = {
  job: { id: "festival-1", title: "Stage Test Festival" },
  jobId: "festival-1",
  navigate: vi.fn(),
  isSchedulingRoute: false,
  jobDates: [],
  isViewOnly: false,
  isAssignmentDialogOpen: false,
  setIsAssignmentDialogOpen: vi.fn(),
  handleAssignmentChange: vi.fn(),
  assignmentDepartment: "sound",
  isJobDetailsOpen: false,
  setIsJobDetailsOpen: vi.fn(),
  isFlexLogOpen: false,
  setIsFlexLogOpen: vi.fn(),
  isFlexPickerOpen: false,
  setIsFlexPickerOpen: vi.fn(),
  handleFlexPickerConfirm: vi.fn(),
  flexPickerOptions: undefined,
  isRouteSheetOpen: false,
  setIsRouteSheetOpen: vi.fn(),
  isPrintDialogOpen: false,
  setIsPrintDialogOpen: vi.fn(),
  handlePrintAllDocumentation: vi.fn(),
  maxStages: 3,
  isJobPresetsOpen: false,
  setIsJobPresetsOpen: vi.fn(),
  isArchiveDialogOpen: false,
  setIsArchiveDialogOpen: vi.fn(),
  archiveMode: "by-prefix",
  setArchiveMode: vi.fn(),
  archiveIncludeTemplates: false,
  setArchiveIncludeTemplates: vi.fn(),
  archiveDryRun: false,
  setArchiveDryRun: vi.fn(),
  isArchiving: false,
  archiveResult: null,
  archiveError: null,
  handleArchiveToFlex: vi.fn(),
  isBackfillDialogOpen: false,
  setIsBackfillDialogOpen: vi.fn(),
  bfSound: true,
  setBfSound: vi.fn(),
  bfLights: true,
  setBfLights: vi.fn(),
  bfVideo: true,
  setBfVideo: vi.fn(),
  bfProduction: true,
  setBfProduction: vi.fn(),
  uuidSound: "",
  setUuidSound: vi.fn(),
  uuidLights: "",
  setUuidLights: vi.fn(),
  uuidVideo: "",
  setUuidVideo: vi.fn(),
  uuidProduction: "",
  setUuidProduction: vi.fn(),
  isWhatsappDialogOpen: true,
  setIsWhatsappDialogOpen: vi.fn(),
  festivalStageOptions: [
    { number: 1, name: "Main Stage" },
    { number: 2, name: "Second Stage" },
    { number: 3, name: "Third Stage" },
  ],
  waGroup: null,
  waRequest: null,
  isSendingWa: false,
  handleRetryWhatsappGroup: vi.fn(),
  isAlmacenDialogOpen: false,
  setIsAlmacenDialogOpen: vi.fn(),
  waMessage: "",
  setWaMessage: vi.fn(),
  handleSendToAlmacen: vi.fn(),
  isDeleteDialogOpen: false,
  setIsDeleteDialogOpen: vi.fn(),
  isDeleting: false,
  handleDeleteJob: vi.fn(),
};

function FestivalWhatsappHarness({ onCreate }: { onCreate: (payload: { department: string; stage_number: number }) => void }) {
  const [waDepartment, setWaDepartment] = React.useState<"sound" | "lights" | "video">("sound");
  const [waStageNumber, setWaStageNumber] = React.useState(1);

  return (
    <FestivalManagementDialogs
      vm={{
        ...baseVm,
        waDepartment,
        setWaDepartment,
        waStageNumber,
        setWaStageNumber,
        handleCreateWhatsappGroup: () => {
          onCreate({
            department: waDepartment,
            stage_number: waDepartment === "sound" ? waStageNumber : 0,
          });
        },
      }}
    />
  );
}

describe("FestivalManagementDialogs WhatsApp stage scope", () => {
  it("uses the selected sound stage for multi-stage festival WhatsApp groups", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(<FestivalWhatsappHarness onCreate={onCreate} />);

    expect(screen.getByText("Stage de sonido")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox"), "2");
    await user.click(screen.getByRole("button", { name: "Crear Grupo" }));

    expect(onCreate).toHaveBeenCalledWith({ department: "sound", stage_number: 2 });
  });

  it("keeps lights and video WhatsApp groups at global stage zero", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    renderWithProviders(<FestivalWhatsappHarness onCreate={onCreate} />);

    await user.click(screen.getByRole("radio", { name: "Vídeo" }));
    expect(screen.queryByText("Stage de sonido")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear Grupo" }));
    expect(onCreate).toHaveBeenLastCalledWith({ department: "video", stage_number: 0 });

    await user.click(screen.getByRole("radio", { name: "Luces" }));
    expect(screen.queryByText("Stage de sonido")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Crear Grupo" }));
    expect(onCreate).toHaveBeenLastCalledWith({ department: "lights", stage_number: 0 });
  });
});
