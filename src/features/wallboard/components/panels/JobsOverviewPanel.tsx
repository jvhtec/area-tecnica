import type { JobsOverviewFeed, JobsOverviewJob } from '../../types';
import { formatJobWhen } from '../../format';
import { DEPARTMENTS, DEPT_LABELS, PANEL_PAGE_SIZES, crewBar, getJobReadiness, paginate, shortDocLabel, sortByUrgency } from '../../model';
import { EmptyState, JobSwatch, StatusPill } from '../shared';

const DOC_STATE_CLASS = { delivered: 'is-delivered', pending: 'is-pending', missing: 'is-missing' } as const;

const DeptRow = ({ job, dept }: { job: JobsOverviewJob; dept: (typeof DEPARTMENTS)[number] }) => {
  if (!job.departments.includes(dept)) {
    return (
      <div className="wb-dept-row is-na">
        <span className="wb-dept-label">{DEPT_LABELS[dept]}</span>
        <span className="wb-crew-count"><b>—</b></span>
        <span className="wb-chips"><span className="wb-chip is-muted">No aplica</span></span>
      </div>
    );
  }

  const assigned = job.crewAssigned[dept] ?? 0;
  const needed = job.crewNeeded[dept] ?? 0;
  const bar = crewBar(assigned, needed);
  const checklist = (job.docChecklist ?? []).filter((item) => item.dept === dept);
  const fallback = job.docs[dept];

  return (
    <div className="wb-dept-row">
      <span className="wb-dept-label">{DEPT_LABELS[dept]}</span>
      <span className="wb-crew-count">
        <b>{needed > 0 ? `${assigned}/${needed}` : assigned}</b>
        <span className="wb-bar"><i style={{ width: bar.width, background: bar.color }} /></span>
      </span>
      <span className="wb-chips">
        {checklist.map((item) => (
          <span key={item.key} className={`wb-chip ${DOC_STATE_CLASS[item.state]}`}>
            {item.state === 'delivered' ? '✓ ' : ''}
            {shortDocLabel(item)}
          </span>
        ))}
        {checklist.length === 0 && fallback && fallback.need > 0 ? (
          <span className={`wb-chip ${fallback.have >= fallback.need ? 'is-delivered' : 'is-pending'}`}>
            Docs {fallback.have}/{fallback.need}
          </span>
        ) : null}
      </span>
    </div>
  );
};

export const JobsOverviewPanel = ({
  data,
  highlightIds,
  page = 0,
  now = new Date(),
}: {
  data: JobsOverviewFeed | null;
  highlightIds?: Set<string>;
  page?: number;
  now?: Date;
}) => {
  const jobs = sortByUrgency(data?.jobs ?? [], now);
  if (!jobs.length) return <EmptyState>No hay trabajos en los próximos 7 días</EmptyState>;

  return (
    <div className="wb-body wb-grid-2">
      {paginate(jobs, page, PANEL_PAGE_SIZES.overview).map((job) => (
        <article key={job.id} className={`wb-card wb-job${highlightIds?.has(job.id) ? ' is-highlight' : ''}`}>
          <div className="wb-job-head">
            <JobSwatch color={job.color} />
            <span className="wb-job-name">{job.title}</span>
            <StatusPill readiness={getJobReadiness(job, now)} />
          </div>
          <div className="wb-job-meta">
            <b>{formatJobWhen(job.start_time, job.end_time, now)}</b>
            <span>{job.location?.name ?? 'Sin ubicación'}</span>
          </div>
          <div className="wb-depts">
            {DEPARTMENTS.map((dept) => <DeptRow key={dept} job={job} dept={dept} />)}
          </div>
        </article>
      ))}
    </div>
  );
};
