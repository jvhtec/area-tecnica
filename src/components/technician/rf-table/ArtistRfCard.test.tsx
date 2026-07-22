// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ArtistRfIemData } from "@/utils/rfIemTablePdfExport";
import { ArtistRfCard } from "./ArtistRfCard";

const artist: ArtistRfIemData = {
  name: "Banda Uno",
  stage: 1,
  showStart: "22:30",
  showEnd: "23:45",
  soundcheckStart: "18:00",
  soundcheckEnd: "18:30",
  wirelessSystems: [
    {
      model: "Axient",
      quantity_ch: 6,
      quantity_hh: 4,
      quantity_bp: 2,
      provided_by: "festival",
    },
  ],
  iemSystems: [
    {
      model: "PSM 1000",
      quantity_hh: 4,
      quantity_bp: 4,
      provided_by: "band",
    },
  ],
};

describe("ArtistRfCard", () => {
  it("keeps the inventory summary visible and expands the detailed spec sheet", async () => {
    const user = userEvent.setup();
    render(<ArtistRfCard artist={artist} stageName="Escenario Norte" isDark={false} />);

    expect(screen.getByText("Banda Uno")).toBeInTheDocument();
    expect(screen.getByText("ESCENARIO NORTE")).toBeInTheDocument();
    expect(screen.getByText("RF CH").previousElementSibling).toHaveTextContent("6");
    expect(screen.getByText("IEM CH").previousElementSibling).toHaveTextContent("4");

    const trigger = screen.getByRole("button", { expanded: false });
    const details = screen.getByText("Soundcheck").closest("[data-state]");
    expect(details).toHaveAttribute("data-state", "closed");
    expect(details).toHaveClass("max-h-0");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(details).toHaveAttribute("data-state", "open");
    expect(details).toHaveClass("max-h-[800px]");
    expect(screen.getByText("Soundcheck")).toBeInTheDocument();
    expect(screen.getByText("Axient")).toBeInTheDocument();
    expect(screen.getByText("PSM 1000")).toBeInTheDocument();
  });
});
