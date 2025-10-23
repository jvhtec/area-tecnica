import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

const {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} = await import("@/components/ui/sidebar");

function MobileNavigationHarness() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div>
        <Sidebar>
          <SidebarContent>
            <button type="button">Dashboard</button>
            <button type="button">Personal</button>
          </SidebarContent>
        </Sidebar>
        <SidebarTrigger aria-label="Toggle navigation" />
      </div>
    </SidebarProvider>
  );
}

describe("mobile navigation", () => {
  it("provides an accessible trigger and opens the mobile sheet", async () => {
    const user = userEvent.setup();
    render(<MobileNavigationHarness />);

    const trigger = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(trigger).toBeInTheDocument();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveAttribute("data-mobile", "true");
    expect(drawer).toBeVisible();
  });

  it("toggles the sheet closed again on a second tap", async () => {
    const user = userEvent.setup();
    render(<MobileNavigationHarness />);

    const trigger = screen.getByRole("button", { name: /toggle sidebar/i });

    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
