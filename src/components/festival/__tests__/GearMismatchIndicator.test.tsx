import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const { isMobileMock } = vi.hoisted(() => ({ isMobileMock: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => isMobileMock() }));

import { GearMismatchIndicator } from "../GearMismatchIndicator";

const mismatches = [
  {
    type: "console",
    severity: "error",
    message: "Consola FOH no disponible",
    details: "Disponible: Ninguna",
  },
] as any;

const triggerName = /detalles del estado del equipo/i;

beforeEach(() => isMobileMock.mockReset());

describe("GearMismatchIndicator", () => {
  it("exposes a tappable details trigger on mobile (touch has no hover)", () => {
    isMobileMock.mockReturnValue(true);
    render(<GearMismatchIndicator mismatches={mismatches} compact />);
    expect(screen.getByRole("button", { name: triggerName })).toBeInTheDocument();
  });

  it("uses the hover tooltip (no tap button) on desktop", () => {
    isMobileMock.mockReturnValue(false);
    render(
      <TooltipProvider>
        <GearMismatchIndicator mismatches={mismatches} compact />
      </TooltipProvider>,
    );
    expect(screen.queryByRole("button", { name: triggerName })).not.toBeInTheDocument();
  });

  it("renders the all-clear badge with no trigger when there are no mismatches", () => {
    isMobileMock.mockReturnValue(true);
    render(<GearMismatchIndicator mismatches={[]} compact />);
    expect(screen.queryByRole("button", { name: triggerName })).not.toBeInTheDocument();
  });
});
