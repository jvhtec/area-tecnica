import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransportRequestRecord } from "@/features/logistics/transportRequests";
import { TransportRequestPlanningDialog } from "./TransportRequestPlanningDialog";

const { schedule } = vi.hoisted(() => ({ schedule: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/logistics/transportRequests", () => ({ scheduleTransportRequest: schedule }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("TransportRequestPlanningDialog", () => {
  afterEach(cleanup);
  it.each(["Llamar al conductor", null])("preserves saved operational notes %j when changing a time", async (notes) => {
    const request = {
      id: "request-1", job_title: "Gira de prueba", note: "Nota de la solicitud", needed_at: null,
      items: [{ transport_type: "trailer", leftover_space_meters: null }],
      events: [
        { id: "load-1", event_type: "load", event_date: "2026-09-20", event_time: "09:00:00", notes },
        { id: "unload-1", event_type: "unload", event_date: "2026-09-20", event_time: "18:00:00", notes },
      ],
    } as TransportRequestRecord;
    const view = render(<TransportRequestPlanningDialog open onOpenChange={vi.fn()} request={request} />);

    expect(screen.getByLabelText("Notas operativas")).toHaveValue(notes ?? "");
    fireEvent.change(screen.getByLabelText("Carga · hora"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar planificación" }));
    await waitFor(() => expect(schedule).toHaveBeenLastCalledWith(expect.objectContaining({
      requestId: "request-1", loadTime: "10:00", notes,
    })));
    view.unmount();
  });
});
