import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const { isMobileMock } = vi.hoisted(() => ({ isMobileMock: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => isMobileMock() }));

import { GearMismatchIndicator } from "@/components/festival/GearMismatchIndicator";
import type { GearMismatch } from "@/utils/gearComparisonService";

const mismatches: GearMismatch[] = [
  {
    type: "console",
    severity: "error",
    message: "Consola FOH no disponible",
    details: "Disponible: Ninguna",
  },
];

const triggerName = /detalles del estado del equipo/i;

beforeEach(() => isMobileMock.mockReset());

describe("GearMismatchIndicator", () => {
  it("exposes a focusable trigger button on mobile (touch has no hover)", () => {
    isMobileMock.mockReturnValue(true);
    render(<GearMismatchIndicator mismatches={mismatches} compact />);
    expect(screen.getByRole("button", { name: triggerName })).toBeInTheDocument();
  });

  it("opens the details popover when the mobile trigger is tapped", () => {
    isMobileMock.mockReturnValue(true);
    render(<GearMismatchIndicator mismatches={mismatches} compact />);

    const trigger = screen.getByRole("button", { name: triggerName });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("exposes a keyboard-focusable trigger button on desktop too (tooltip opens on focus, not only hover)", () => {
    isMobileMock.mockReturnValue(false);
    render(
      <TooltipProvider>
        <GearMismatchIndicator mismatches={mismatches} compact />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button", { name: triggerName })).toBeInTheDocument();
  });

  it("renders the all-clear badge with no trigger when there are no mismatches", () => {
    isMobileMock.mockReturnValue(true);
    render(<GearMismatchIndicator mismatches={[]} compact />);
    expect(screen.queryByRole("button", { name: triggerName })).not.toBeInTheDocument();
  });
});
