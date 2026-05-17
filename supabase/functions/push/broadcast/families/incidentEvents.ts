import { EVENT_TYPES } from "../../config.ts";
import type { BroadcastEventContext, BroadcastHandlerResult } from "../eventContext.ts";
import { setBroadcastMessage } from "../eventContext.ts";

export async function handleIncidentEvents(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  if (context.type !== EVENT_TYPES.INCIDENT_REPORT_UPLOADED) {
    return false;
  }

  const { body, actor, jobTitle, state, audience, userId } = context;
  const fileName = body.file_name || 'reporte de incidencia';
  setBroadcastMessage(
    state,
    '⚠️ Reporte de incidencia',
    `${actor} ha reportado una incidencia en "${jobTitle || 'Trabajo'}": ${fileName}`,
  );

  audience.clearAllRecipients();
  audience.addRecipients([userId]);

  const soundMgmt = Array.from(audience.management).filter((id) => audience.soundDept.has(id));
  audience.addNaturalRecipients([...soundMgmt, ...Array.from(audience.admin)]);
  audience.addNaturalRecipients(Array.from(audience.participants));

  state.metaExtras.view = 'incident-reports';
  state.metaExtras.targetUrl = `/incident-reports`;

  console.log('Incident report notification - recipients:', audience.recipients.size);
  return true;
}
