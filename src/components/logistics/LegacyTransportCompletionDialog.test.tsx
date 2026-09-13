import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TransportRequestRecord } from "@/features/logistics/transportRequests";
import { LegacyTransportCompletionDialog } from "./LegacyTransportCompletionDialog";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: { rpc } }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

describe("legacy transport completion", () => {
  afterEach(cleanup);

  it("retains the reason on failure and waits for success before closing", async () => {
    let finish: (value: { data: null; error: null }) => void = () => undefined;
    rpc.mockResolvedValueOnce({ data: null, error: { message: "No tienes permiso para cerrar esta solicitud" } });
    rpc.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const onClose = vi.fn();
    const onCompleted = vi.fn();
    render(<LegacyTransportCompletionDialog
      request={{ id: "legacy-1", job_title: "Festival antiguo" } as TransportRequestRecord}
      onClose={onClose} onCompleted={onCompleted}
    />);

    fireEvent.change(screen.getByLabelText("Motivo del cierre"), { target: { value: "  Transporte ya realizado  " } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso");
    expect(onClose).not.toHaveBeenCalled();
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Motivo del cierre")).toHaveValue("  Transporte ya realizado  ");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar cierre" }));
    expect(screen.getByRole("button", { name: "Completando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Volver" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    finish({ data: null, error: null });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenLastCalledWith("complete_legacy_transport_request", {
      p_request_id: "legacy-1", p_reason: "Transporte ya realizado",
    });
  });
});
