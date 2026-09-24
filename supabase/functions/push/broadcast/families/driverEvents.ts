import { getLogisticsManagementRecipients, getProfileRoles } from "../../data.ts";
import { isConductorProfile, loadDriverAssignmentFacts } from "../../driverAssignments.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";
import {
  buildDriverAssignedMessage,
  buildDriverRemovedMessage,
  buildDriverResponseMessage,
} from "../messages/driverMessages.ts";

const DRIVER_HOME = "/conductor";
const LOGISTICS_DRIVERS_VIEW = "/logistics?tab=drivers";

/**
 * Logistics-matrix driver assignments. Recipients are always derived from the
 * stored assignment (or, for a removal, from a verified conductor profile), never
 * from caller-supplied ids.
 */
export async function handleDriverEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  const { type, body, state, audience, client } = context;
  if (!type.startsWith("logistics.driver.")) return false;

  audience.clearAllRecipients();
  state.metaExtras.view = "logistics-driver";

  if (type === "logistics.driver.assigned" || type === "logistics.driver.updated") {
    const facts = await loadDriverAssignmentFacts(client, body.assignment_id);
    if (!facts?.driverId) return true;
    const message = buildDriverAssignedMessage(facts, type === "logistics.driver.updated");
    setBroadcastMessage(state, message.title, message.text);
    state.url = DRIVER_HOME;
    state.metaExtras.targetUrl = DRIVER_HOME;
    audience.addNaturalRecipients([facts.driverId]);
    return true;
  }

  if (type === "logistics.driver.removed") {
    if (!(await isConductorProfile(client, body.recipient_id))) return true;
    const message = buildDriverRemovedMessage(body.starts_at, body.timezone);
    setBroadcastMessage(state, message.title, message.text);
    state.url = DRIVER_HOME;
    state.metaExtras.targetUrl = DRIVER_HOME;
    audience.addNaturalRecipients([body.recipient_id]);
    return true;
  }

  if (type === "logistics.driver.confirmed" || type === "logistics.driver.declined") {
    const facts = await loadDriverAssignmentFacts(client, body.assignment_id);
    if (!facts) return true;
    const message = buildDriverResponseMessage(facts, context.actor, type === "logistics.driver.confirmed");
    setBroadcastMessage(state, message.title, message.text);
    state.url = LOGISTICS_DRIVERS_VIEW;
    state.metaExtras.targetUrl = LOGISTICS_DRIVERS_VIEW;
    state.metaExtras.department = "logistics";
    // Whoever assigned it hears back only while they still manage the matrix: the
    // stored assigned_by may belong to someone who has since changed role.
    const assignerRole = facts.assignedBy
      ? (await getProfileRoles(client, [facts.assignedBy])).get(facts.assignedBy)
      : null;
    const assignerStillManages = assignerRole === "admin" || assignerRole === "management";
    audience.addNaturalRecipients([
      ...(await getLogisticsManagementRecipients(client)),
      assignerStillManages ? facts.assignedBy : null,
    ]);
    return true;
  }

  return false;
}
