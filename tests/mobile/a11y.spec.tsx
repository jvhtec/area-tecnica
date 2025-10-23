import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import { VacationRequestForm } from "@/components/personal/VacationRequestForm";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

const {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} = await import("@/components/ui/sidebar");

function MobileNavigationFixture() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div>
        <Sidebar>
          <SidebarContent>
            <button type="button">Dashboard</button>
          </SidebarContent>
        </Sidebar>
        <SidebarTrigger aria-label="Toggle navigation" />
      </div>
    </SidebarProvider>
  );
}

describe("mobile accessibility audits", () => {
  it("keeps the vacation request form free of critical axe violations", async () => {
    const { container } = render(
      <VacationRequestForm onSubmit={() => undefined} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ensures the navigation trigger and drawer meet axe guidance", async () => {
    const user = userEvent.setup();
    const { container, getByRole } = render(<MobileNavigationFixture />);

    await user.click(getByRole("button", { name: /toggle sidebar/i }));

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
