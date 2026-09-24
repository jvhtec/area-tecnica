import type { BroadcastEventContext, BroadcastHandlerResult, BroadcastEventHandler } from "./eventContext.ts";
import { handleAbsenceEvents } from "./families/absenceEvents.ts";
import { handleAssignmentEvents } from "./families/assignmentEvents.ts";
import { handleChangelogEvents } from "./families/changelogEvents.ts";
import { handleDocumentEvents } from "./families/documentEvents.ts";
import { handleDriverEvents } from "./families/driverEvents.ts";
import { handleFallbackEvent } from "./families/fallbackEvent.ts";
import { handleFestivalEvents } from "./families/festivalEvents.ts";
import { handleFinanceEvents } from "./families/financeEvents.ts";
import { handleFlexEvents } from "./families/flexEvents.ts";
import { handleIncidentEvents } from "./families/incidentEvents.ts";
import { handleJobEvents } from "./families/jobEvents.ts";
import { handleLogisticsEvents } from "./families/logisticsEvents.ts";
import { handleMessageEvents } from "./families/messageEvents.ts";
import { handleProductionEvents } from "./families/productionEvents.ts";
import { handleSoundVisionEvents } from "./families/soundVisionEvents.ts";
import { handleStaffingEvents } from "./families/staffingEvents.ts";
import { handleSystemEvents } from "./families/systemEvents.ts";
import { handleTaskEvents } from "./families/taskEvents.ts";
import { handleTimesheetEvents } from "./families/timesheetEvents.ts";
import { handleTourEvents } from "./families/tourEvents.ts";

const eventHandlers: BroadcastEventHandler[] = [
  // Narrower families first: handleJobEvents and handleTimesheetEvents match on
  // broad prefixes that would otherwise swallow job.producer.* and
  // timesheet.reminder.due before their own handlers are reached.
  handleAbsenceEvents,
  handleFinanceEvents,
  handleProductionEvents,
  handleSystemEvents,
  handleJobEvents,
  handleTimesheetEvents,
  handleDocumentEvents,
  handleFestivalEvents,
  handleIncidentEvents,
  handleStaffingEvents,
  handleAssignmentEvents,
  handleTaskEvents,
  handleDriverEvents,
  handleLogisticsEvents,
  handleFlexEvents,
  handleMessageEvents,
  handleTourEvents,
  handleSoundVisionEvents,
  handleChangelogEvents,
];

export async function routeBroadcastEvent(context: BroadcastEventContext): Promise<BroadcastHandlerResult> {
  for (const handleEvent of eventHandlers) {
    const result = await handleEvent(context);
    if (result) {
      return result;
    }
  }

  return handleFallbackEvent(context);
}
