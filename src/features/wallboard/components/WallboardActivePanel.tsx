import { CalendarPanel } from "./panels/CalendarPanel";
import { CrewAssignmentsPanel } from "./panels/CrewAssignmentsPanel";
import { JobsOverviewPanel } from "./panels/JobsOverviewPanel";
import { LogisticsPanel } from "./panels/LogisticsPanel";
import { PendingActionsPanel } from "./panels/PendingActionsPanel";
import { AlienCalendarPanel, AlienCrewPanel, AlienJobsPanel, AlienLogisticsPanel, AlienPendingPanel } from "./alien/AlienPanels";
import type { CalendarFeed, CrewAssignmentsFeed, JobsOverviewFeed, LogisticsItem, PanelKey, PendingActionsFeed } from "../types";

type Props = {
  calendarData: CalendarFeed | null;
  crew: CrewAssignmentsFeed | null;
  current: PanelKey;
  highlightJobs: Map<string, number>;
  isAlien: boolean;
  isProduccionPreset: boolean;
  logistics: LogisticsItem[] | null;
  overview: JobsOverviewFeed | null;
  panelPages: Record<PanelKey, number>;
  pending: PendingActionsFeed | null;
  theme: "light" | "dark";
};

export const WallboardActivePanel = ({ calendarData, crew, current, highlightJobs, isAlien, isProduccionPreset, logistics, overview, panelPages, pending, theme }: Props) => {
  const highlightIds = new Set(highlightJobs.keys());
  if (current === "overview") return isAlien ? <AlienJobsPanel data={overview} highlightIds={highlightIds} /> : <JobsOverviewPanel data={overview} highlightIds={highlightIds} page={panelPages.overview} theme={theme} />;
  if (current === "crew") return isAlien ? <AlienCrewPanel data={crew} /> : <CrewAssignmentsPanel data={crew} page={panelPages.crew} theme={theme} />;
  if (current === "logistics") return isAlien ? <AlienLogisticsPanel data={logistics} /> : <LogisticsPanel data={logistics} page={panelPages.logistics} theme={theme} />;
  if (current === "pending") return isAlien ? <AlienPendingPanel data={pending} /> : <PendingActionsPanel data={pending} theme={theme} />;
  if (current === "calendar") return isAlien ? <AlienCalendarPanel data={calendarData} highlightIds={highlightIds} /> : <CalendarPanel data={calendarData} highlightIds={highlightIds} theme={theme} scrollSpeed={isProduccionPreset ? 20 : 50} />;
  return null;
};
