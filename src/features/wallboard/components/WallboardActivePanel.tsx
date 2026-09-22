import { CalendarPanel } from './panels/CalendarPanel';
import { CrewAssignmentsPanel } from './panels/CrewAssignmentsPanel';
import { DocumentsPanel } from './panels/DocumentsPanel';
import { JobsOverviewPanel } from './panels/JobsOverviewPanel';
import { LogisticsPanel } from './panels/LogisticsPanel';
import { PendingActionsPanel } from './panels/PendingActionsPanel';
import {
  AlienCalendarPanel,
  AlienCrewPanel,
  AlienDocsPanel,
  AlienJobsPanel,
  AlienLogisticsPanel,
  AlienPendingPanel,
} from './alien/AlienPanels';
import { getDocJobs } from '../model';
import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  DocProgressFeed,
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
  isAlien: boolean;
  logistics: LogisticsItem[] | null;
  now: Date;
  overview: JobsOverviewFeed | null;
  panelPages: Record<PanelKey, number>;
  pending: PendingActionsFeed | null;
};

/** Adapts the per-document checklist to the Alien theme's progress-bar shape. */
function toDocProgress(overview: JobsOverviewFeed | null): DocProgressFeed {
  return {
    jobs: getDocJobs(overview).map((job) => ({
      id: job.id,
      title: job.title,
      color: job.color,
      job_type: job.job_type,
      start_time: job.start_time,
      end_time: job.end_time,
      departments: job.departments.map((dept) => {
        const items = (job.docChecklist ?? []).filter((item) => item.dept === dept);
        return {
          dept,
          have: items.filter((item) => item.state === 'delivered').length,
          need: items.length,
          missing: items.filter((item) => item.state !== 'delivered').map((item) => item.label),
        };
      }),
    })),
  };
}

const AlienFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="h-full overflow-hidden p-4">{children}</div>
);

export const WallboardActivePanel = ({
  calendarData,
  crew,
  current,
  highlightJobs,
  isAlien,
  logistics,
  now,
  overview,
  panelPages,
  pending,
}: Props) => {
  const highlightIds = new Set(highlightJobs.keys());

  if (isAlien) {
    return (
      <AlienFrame>
        {current === 'overview' && <AlienJobsPanel data={overview} highlightIds={highlightIds} />}
        {current === 'docs' && <AlienDocsPanel data={toDocProgress(overview)} />}
        {current === 'crew' && <AlienCrewPanel data={crew} />}
        {current === 'logistics' && <AlienLogisticsPanel data={logistics} />}
        {current === 'pending' && <AlienPendingPanel data={pending} />}
        {current === 'calendar' && <AlienCalendarPanel data={calendarData} highlightIds={highlightIds} />}
      </AlienFrame>
    );
  }

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
