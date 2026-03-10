// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createUserProfile } from "@/test/fixtures";
import { mockSupabase, resetMockSupabase } from "@/test/mockSupabase";
import { renderWithProviders } from "@/test/renderWithProviders";

const { useOptimizedAuthMock, toastMock } = vi.hoisted(() => ({
  useOptimizedAuthMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/hooks/useOptimizedAuth", () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: mockSupabase,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: any[]) => toastMock(...args),
}));

vi.mock("@/components/settings/HouseTechRateEditor", () => ({
  HouseTechRateEditor: () => <div>House tech rate editor</div>,
}));

vi.mock("@/components/maps/CityAutocomplete", () => ({
  CityAutocomplete: ({ value, onChange }: { value: string; onChange: (city: string, coordinates?: { lat: number; lng: number }) => void }) => (
    <div>
      <div>City value: {value}</div>
      <button type="button" onClick={() => onChange("Valencia", { lat: 39.4699, lng: -0.3763 })}>
        Select Valencia
      </button>
    </div>
  ),
}));

vi.mock("@/components/profile/ProfilePictureUpload", () => ({
  ProfilePictureUpload: ({
    currentPictureUrl,
    onUploadComplete,
    onRemove,
  }: {
    currentPictureUrl?: string | null;
    onUploadComplete?: (url: string) => void;
    onRemove?: () => void;
  }) => (
    <div>
      <div>Profile picture: {currentPictureUrl ?? "none"}</div>
      <button type="button" onClick={() => onUploadComplete?.("https://cdn.example/avatar.webp")}>
        Simulate Upload
      </button>
      <button type="button" onClick={() => onRemove?.()}>
        Simulate Remove
      </button>
    </div>
  ),
}));

import { EditUserDialog } from "../EditUserDialog";

describe("EditUserDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockSupabase();
    useOptimizedAuthMock.mockReturnValue({ userRole: "management" });
    mockSupabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  const renderDialog = (
    user = createUserProfile(),
    props: Partial<React.ComponentProps<typeof EditUserDialog>> = {},
  ) => {
    const onOpenChange = props.onOpenChange ?? vi.fn();
    const onSave = props.onSave ?? vi.fn();

    renderWithProviders(
      <EditUserDialog
        user={user as any}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />,
    );

    return { onOpenChange, onSave };
  };

  it("forces SoundVision access for sound house techs and persists edited payload fields", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog(
      createUserProfile({
        id: "house-1",
        first_name: "House",
        last_name: "Tech",
        role: "house_tech",
        department: "sound",
        soundvision_access_enabled: false,
        assignable_as_tech: false,
        residencia: "Madrid",
        home_latitude: null,
        home_longitude: null,
        bg_color: null,
        profile_picture_url: null,
      }),
    );

    expect(screen.getByText("House techs always retain SoundVision access.")).toBeInTheDocument();
    const soundVisionCheckbox = screen.getByRole("checkbox", { name: /soundvision access/i });
    expect(soundVisionCheckbox).toBeChecked();
    expect(soundVisionCheckbox).toBeDisabled();

    expect(screen.getByText("Profile picture: none")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /simulate upload/i }));
    expect(screen.getByText("Profile picture: https://cdn.example/avatar.webp")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /simulate remove/i }));
    expect(screen.getByText("Profile picture: none")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /select valencia/i }));
    await user.click(screen.getByRole("checkbox", { name: /assignable to jobs as tech/i }));
    await user.click(screen.getByTitle("Blue"));

    await user.clear(screen.getByLabelText(/first name/i));
    await user.type(screen.getByLabelText(/first name/i), "Jordan");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "house-1",
          first_name: "Jordan",
          role: "house_tech",
          department: "sound",
          assignable_as_tech: true,
          soundvision_access_enabled: true,
          residencia: "Valencia",
          home_latitude: 39.4699,
          home_longitude: -0.3763,
          bg_color: "#2563EB",
        }),
      );
    });
  });

  it("lets management enable SoundVision for sound technicians and extract Flex IDs from URLs or raw UUIDs", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog(
      createUserProfile({
        id: "tech-1",
        role: "technician",
        department: "sound",
        soundvision_access_enabled: false,
        flex_resource_id: null,
      }),
    );

    const soundVisionCheckbox = screen.getByRole("checkbox", { name: /soundvision access/i });
    expect(soundVisionCheckbox).not.toBeChecked();

    await user.click(soundVisionCheckbox);
    expect(soundVisionCheckbox).toBeChecked();

    const flexUrlInput = screen.getByLabelText(/flex contact url/i);
    const flexIdInput = screen.getByLabelText(/flex resource id/i);
    const extractedFromUrl = "4b0d98e0-e700-11ea-97d0-2a0a4490a7fb";
    const extractedFromRaw = "5b0d98e0-e700-11ea-97d0-2a0a4490a7fb";

    await user.type(
      flexUrlInput,
      `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact/${extractedFromUrl}/phone`,
    );
    await user.click(screen.getByRole("button", { name: /^extract$/i }));
    expect(flexIdInput).toHaveValue(extractedFromUrl);

    await user.clear(flexUrlInput);
    await user.type(flexUrlInput, extractedFromRaw);
    await user.click(screen.getByRole("button", { name: /^extract$/i }));
    expect(flexIdInput).toHaveValue(extractedFromRaw);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "tech-1",
          soundvision_access_enabled: true,
          flex_resource_id: extractedFromRaw,
        }),
      );
    });
  });

  it("sends onboarding emails and surfaces both success and failure toasts", async () => {
    const user = userEvent.setup();
    renderDialog(
      createUserProfile({
        id: "user-1",
        email: "tech@example.com",
        first_name: "Pat",
        last_name: "Jones",
        department: "sound",
      }),
    );

    await user.click(screen.getByRole("button", { name: /send onboarding email/i }));

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("send-onboarding-email", {
      body: {
        email: "tech@example.com",
        firstName: "Pat",
        lastName: "Jones",
        department: "sound",
      },
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Onboarding email sent",
        variant: "success",
      }),
    );

    mockSupabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error("service down"),
    });

    await user.click(screen.getByRole("button", { name: /send onboarding email/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Failed to send onboarding",
        variant: "destructive",
      }),
    );
  });
});
