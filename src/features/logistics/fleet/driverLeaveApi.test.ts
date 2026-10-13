import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDriverLeave } from "./driverLeaveApi";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/services/dataLayerClient", () => ({ dataLayerClient: { rpc } }));
beforeEach(() => rpc.mockReset());
describe("Descansos de conductores", () => {
  it("guarda el periodo inclusivo por el RPC existente", async () => {
    rpc.mockResolvedValue({ error: null });
    await setDriverLeave("driver", "2026-10-13", "2026-10-15", "day_off");
    expect(rpc).toHaveBeenCalledWith("set_logistics_driver_leave", { p_driver: "driver", p_start: "2026-10-13", p_end: "2026-10-15", p_status: "day_off" });
  });
  it("elimina descansos con clear y propaga el rechazo del servidor", async () => {
    rpc.mockResolvedValue({ error: { message: "El periodo coincide con vacaciones aprobadas." } });
    await expect(setDriverLeave("driver", "2026-10-13", "2026-10-15", "clear")).rejects.toThrow("vacaciones aprobadas");
    expect(rpc.mock.calls[0][1].p_status).toBe("clear");
  });
});
