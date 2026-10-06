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
  it("suggests the requested Madrid delivery time and copies the pickup date without changing time", async () => {
    const request = { id: "new", job_id: "job", department: "sound", status: "requested", planning_status: "requested", movement_type: "delivery", priority: "normal", source_type: "manual", source_ref: null, is_hoja_relevant: true, created_at: "2026-10-01", updated_at: "2026-10-01", created_by: null, requester_name: null, job_title: "Festival", description: "Equipo de sonido", origin: "Almacén", destination: "Recinto", needed_at: "2026-10-01T12:00:00Z", note: null, items: [{ transport_type: "furgoneta", leftover_space_meters: null }], events: [] } as TransportRequestRecord;
    render(<TransportRequestPlanningDialog open onOpenChange={vi.fn()} request={request} />);
    expect(screen.getByLabelText("Descarga · hora")).toHaveValue("14:00");
    expect(screen.getByLabelText("Carga · hora")).toHaveValue("");
    expect(screen.getByText("Almacén → Recinto")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Carga · fecha"), { target: { value: "2026-09-30" } });
    fireEvent.change(screen.getByLabelText("Carga · hora"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrega el mismo día" }));
    expect(screen.getByLabelText("Descarga · fecha")).toHaveValue("2026-09-30");
    expect(screen.getByLabelText("Descarga · hora")).toHaveValue("14:00");
    fireEvent.click(screen.getByRole("button", { name: "Guardar planificación" }));
    await waitFor(() => expect(schedule).toHaveBeenLastCalledWith(expect.objectContaining({ loadDate: "2026-09-30", unloadDate: "2026-09-30", loadTime: "11:00", unloadTime: "14:00" })));
  });
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
