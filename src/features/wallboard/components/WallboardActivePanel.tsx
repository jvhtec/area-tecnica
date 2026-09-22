import { CalendarPanel } from './panels/CalendarPanel';
import { CrewAssignmentsPanel } from './panels/CrewAssignmentsPanel';
import { DocumentsPanel } from './panels/DocumentsPanel';
import { JobsOverviewPanel } from './panels/JobsOverviewPanel';
import { LogisticsPanel } from './panels/LogisticsPanel';
import { PendingActionsPanel } from './panels/PendingActionsPanel';
import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  JobsOverviewFeed,
  LogisticsItem,
  PanelKey,
  PendingActionsFeed,
} from '../types';

type Props = {
  calendarData: CalendarFeed | null;
  crew: CrewAssignmentsFeed | null;
  current: PanelKey;
  highlightJobs: Map<string, number>;
  logistics: LogisticsItem[] | null;
  now: Date;
  overview: JobsOverviewFeed | null;
  panelPages: Record<PanelKey, number>;
  pending: PendingActionsFeed | null;
};

export const WallboardActivePanel = ({
  calendarData,
  crew,
  current,
  highlightJobs,
  logistics,
  now,
  overview,
  panelPages,
  pending,
}: Props) => {
  const highlightIds = new Set(highlightJobs.keys());

  switch (current) {
    case 'overview':
      return <JobsOverviewPanel data={overview} highlightIds={highlightIds} page={panelPages.overview} now={now} />;
    case 'docs':
      return <DocumentsPanel data={overview} page={panelPages.docs} now={now} />;
    case 'crew':
      return <CrewAssignmentsPanel data={crew} page={panelPages.crew} now={now} />;
    case 'logistics':
      return <LogisticsPanel data={logistics} page={panelPages.logistics} now={now} />;
    case 'pending':
      return <PendingActionsPanel data={pending} page={panelPages.pending} now={now} />;
    case 'calendar':
      return <CalendarPanel data={calendarData} highlightIds={highlightIds} now={now} />;
    default:
      return null;
  }
};
