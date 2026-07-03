// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FestivalPushFeedButton } from "@/components/festival/FestivalPushFeedButton";

const { pushStateMock, feedStateMock } = vi.hoisted(() => ({
  pushStateMock: vi.fn(),
  feedStateMock: vi.fn(),
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => pushStateMock(),
}));

vi.mock("@/hooks/festival/useFestivalPushSubscription", () => ({
  useFestivalPushSubscription: () => feedStateMock(),
}));

const renderButton = (onActivatePushClick = vi.fn()) =>
  render(
    <MemoryRouter>
      <FestivalPushFeedButton jobId="job-1" onActivatePushClick={onActivatePushClick} />
    </MemoryRouter>,
  );

describe("FestivalPushFeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushStateMock.mockReturnValue({
      subscription: { endpoint: "https://push.example/sub" },
      isInitializing: false,
    });
    feedStateMock.mockReturnValue({
      subscription: { enabled: false, stages: [] },
      isSubscribed: false,
      selectedStages: [],
      stageOptions: [
        { number: 1, label: "Escenario Norte", assigned: true },
        { number: 2, label: "Escenario Sur", assigned: true },
      ],
      canChooseAnyStage: false,
      isLoading: false,
      isSaving: false,
      error: null,
      save: vi.fn().mockResolvedValue({ enabled: true, stages: [1, 2] }),
    });
  });

  it("shows Spanish guidance when device push is inactive", async () => {
    const user = userEvent.setup();
    const onActivatePushClick = vi.fn();
    pushStateMock.mockReturnValue({
      subscription: null,
      isInitializing: false,
    });

    renderButton(onActivatePushClick);

    await user.click(screen.getByRole("button", { name: /feed de avisos del festival/i }));

    expect(screen.getByText("Activa las notificaciones push en Perfil para suscribirte a este feed."))
      .toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ir a perfil/i }));
    expect(onActivatePushClick).toHaveBeenCalledTimes(1);
  });

  it("saves multiple selected stages", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue({ enabled: true, stages: [1, 2] });
    feedStateMock.mockReturnValue({
      subscription: { enabled: false, stages: [] },
      isSubscribed: false,
      selectedStages: [],
      stageOptions: [
        { number: 1, label: "Escenario Norte", assigned: true },
        { number: 2, label: "Escenario Sur", assigned: true },
      ],
      canChooseAnyStage: true,
      isLoading: false,
      isSaving: false,
      error: null,
      save,
    });

    renderButton();

    await user.click(screen.getByRole("button", { name: /feed de avisos del festival/i }));
    await user.click(screen.getByText("Escenario Norte"));
    await user.click(screen.getByText("Escenario Sur"));
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    expect(save).toHaveBeenCalledWith({
      enabled: true,
      stages: [1, 2],
    });
  });
});
