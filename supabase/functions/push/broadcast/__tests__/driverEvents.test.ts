import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facts: vi.fn(),
  isConductor: vi.fn(),
  logisticsManagers: vi.fn(),
  roles: vi.fn(),
}));

vi.mock("../../driverAssignments.ts", () => ({
  loadDriverAssignmentFacts: mocks.facts,
  isConductorProfile: mocks.isConductor,
}));
vi.mock("../../data.ts", () => ({
  getLogisticsManagementRecipients: mocks.logisticsManagers,
  getProfileRoles: mocks.roles,
}));

import { handleDriverEvents } from "../families/driverEvents.ts";
import {
  buildDriverAssignedMessage,
  buildDriverRemovedMessage,
  formatMadridDriverWindow,
} from "../messages/driverMessages.ts";
import type { BroadcastEventContext } from "../eventContext.ts";
import type { BroadcastBody } from "../../types.ts";
import type { DriverAssignmentFacts } from "../../driverAssignments.ts";

const facts: DriverAssignmentFacts = {
  id: "assignment-1",
  driverId: "driver-1",
  assignedBy: "manager-1",
  status: "assigned",
  // 08:00 Madrid (CEST).
  startsAt: "2026-10-01T06:00:00Z",
  endsAt: "2026-10-01T08:00:00Z",
  eventType: "load",
  eventTitle: "Gala Liceu",
  vehicleName: "Tráiler 1",
  vehiclePlate: "1234 ABC",
};

function contextFor(type: string, body: Partial<BroadcastBody> = {}) {
  const recipients = new Set<string>(["caller"]);
  const naturalRecipients = new Set<string>();
  const context = {
    client: {},
    type,
    body: { action: "broadcast", type, ...body },
    actor: "Ana Conductora",
    state: { title: "", text: "", url: "/", metaExtras: {} },
    audience: {
      recipients,
      naturalRecipients,
      addNaturalRecipients: (ids: (string | null | undefined)[]) => {
        for (const id of ids) if (id) { recipients.add(id); naturalRecipients.add(id); }
      },
      clearAllRecipients: () => { recipients.clear(); naturalRecipients.clear(); },
    },
  } as unknown as BroadcastEventContext;
  return { context, recipients };
}

describe("driver push messages", () => {
  it("formats the window in Madrid time", () => {
    expect(formatMadridDriverWindow("2026-10-01T06:00:00Z")).toMatch(/08:00$/);
    expect(formatMadridDriverWindow("not a date")).toBe("");
  });

  it("describes what, when and which vehicle", () => {
    const message = buildDriverAssignedMessage(facts, false);
    expect(message.title).toBe("Nuevo transporte asignado");
    expect(message.text).toContain("Carga · Gala Liceu");
    expect(message.text).toContain("08:00");
    expect(message.text).toContain("Tráiler 1 (1234 ABC)");
    expect(buildDriverAssignedMessage(facts, true).title).toBe("Transporte actualizado");
    expect(buildDriverRemovedMessage(null).text).toBe("Se ha retirado uno de tus transportes asignados.");
  });
});

describe("handleDriverEvents", () => {
  beforeEach(() => {
    mocks.facts.mockReset().mockResolvedValue(facts);
    mocks.isConductor.mockReset().mockResolvedValue(true);
    mocks.logisticsManagers.mockReset().mockResolvedValue(["logistics-1"]);
    mocks.roles.mockReset().mockResolvedValue(new Map([["manager-1", "management"]]));
  });

  it("ignores other event families", async () => {
    const { context } = contextFor("logistics.event.created");
    expect(await handleDriverEvents(context)).toBe(false);
  });

  it("notifies only the stored driver of a new assignment and links to their dashboard", async () => {
    const { context, recipients } = contextFor("logistics.driver.assigned", { assignment_id: "assignment-1" });
    expect(await handleDriverEvents(context)).toBe(true);
    expect([...recipients]).toEqual(["driver-1"]);
    expect(context.state.url).toBe("/conductor");
    expect(context.state.title).toBe("Nuevo transporte asignado");
  });

  it("drops the push when the assignment no longer exists", async () => {
    mocks.facts.mockResolvedValue(null);
    const { context, recipients } = contextFor("logistics.driver.updated", { assignment_id: "gone" });
    expect(await handleDriverEvents(context)).toBe(true);
    expect(recipients.size).toBe(0);
  });

  it("sends a removal only to a verified conductor", async () => {
    const { context, recipients } = contextFor("logistics.driver.removed", { recipient_id: "driver-1" });
    await handleDriverEvents(context);
    expect([...recipients]).toEqual(["driver-1"]);

    mocks.isConductor.mockResolvedValue(false);
    const other = contextFor("logistics.driver.removed", { recipient_id: "manager-2" });
    await handleDriverEvents(other.context);
    expect(other.recipients.size).toBe(0);
  });

  it("tells logistics and whoever assigned it when a driver answers", async () => {
    const { context, recipients } = contextFor("logistics.driver.declined", { assignment_id: "assignment-1" });
    await handleDriverEvents(context);
    expect([...recipients].sort()).toEqual(["logistics-1", "manager-1"]);
    expect(context.state.title).toBe("Transporte rechazado");
    expect(context.state.text).toContain("Ana Conductora rechazó");
    expect(context.state.url).toBe("/logistics?tab=drivers");
  });

  it("leaves out an assigner who no longer manages the matrix", async () => {
    mocks.roles.mockResolvedValue(new Map([["manager-1", "technician"]]));
    const { context, recipients } = contextFor("logistics.driver.confirmed", { assignment_id: "assignment-1" });
    await handleDriverEvents(context);
    expect([...recipients]).toEqual(["logistics-1"]);
  });
});
