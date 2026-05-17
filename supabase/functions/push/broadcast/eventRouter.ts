import type { BroadcastEventContext, BroadcastHandlerResult, BroadcastEventHandler } from "./eventContext.ts";
import { handleAssignmentEvents } from "./families/assignmentEvents.ts";
import { handleChangelogEvents } from "./families/changelogEvents.ts";
import { handleDocumentEvents } from "./families/documentEvents.ts";
import { handleFallbackEvent } from "./families/fallbackEvent.ts";
import { handleFestivalEvents } from "./families/festivalEvents.ts";
import { handleFlexEvents } from "./families/flexEvents.ts";
import { handleIncidentEvents } from "./families/incidentEvents.ts";
import { handleJobEvents } from "./families/jobEvents.ts";
import { handleLogisticsEvents } from "./families/logisticsEvents.ts";
import { handleMessageEvents } from "./families/messageEvents.ts";
import { handleSoundVisionEvents } from "./families/soundVisionEvents.ts";
import { handleStaffingEvents } from "./families/staffingEvents.ts";
import { handleTaskEvents } from "./families/taskEvents.ts";
import { handleTimesheetEvents } from "./families/timesheetEvents.ts";
import { handleTourEvents } from "./families/tourEvents.ts";

const eventHandlers: BroadcastEventHandler[] = [
  handleJobEvents,
  handleTimesheetEvents,
  handleDocumentEvents,
  handleFestivalEvents,
  handleIncidentEvents,
  handleStaffingEvents,
  handleAssignmentEvents,
  handleTaskEvents,
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
