import type { CrewAssignmentsFeed, Dept } from '../../types';
import { formatJobWhen } from '../../format';
import { DEPARTMENTS, DEPT_LABELS, PANEL_PAGE_SIZES, TIMESHEET_TAGS, paginate } from '../../model';
import { EmptyState, JobSwatch } from '../shared';

const SLOTS_PER_COLUMN = 4;
const TONE_CLASS = { ok: 'wb-ok', info: 'wb-info', warn: 'wb-warn', crit: 'wb-crit' } as const;

type CrewJob = CrewAssignmentsFeed['jobs'][number];

const isTourDate = (job: CrewJob) => String(job.jobType ?? job.job_type ?? '').toLowerCase() === 'tourdate';

const CrewColumn = ({ job, dept, jobEnded }: { job: CrewJob; dept: Dept; jobEnded: boolean }) => {
  const people = job.crew.filter((member) => member.dept === dept);
  const needed = job.crewNeeded?.[dept] ?? 0;
  const onJob = job.departments ? job.departments.includes(dept) : people.length > 0;

  if (!onJob) {
    return (
      <div className="wb-crew-col" style={{ opacity: 0.4 }}>
        <h4>{DEPT_LABELS[dept]} <b>—</b></h4>
      </div>
    );
  }

  const shown = people.slice(0, SLOTS_PER_COLUMN);
  const hiddenPeople = people.length - shown.length;
  const vacancies = Math.max(0, needed - people.length);
  const vacancySlots = Math.min(vacancies, SLOTS_PER_COLUMN - shown.length);
  const hiddenVacancies = vacancies - vacancySlots;
  const short = needed > 0 && people.length < needed;
  // Before a job ends a missing timesheet is not overdue, so it is only noise.
  const showTimesheets = jobEnded && !isTourDate(job);

  return (
    <div className="wb-crew-col">
      <h4>
        {DEPT_LABELS[dept]}
        <b style={{ color: needed > 0 ? (short ? 'var(--wb-crit)' : 'var(--wb-ok)') : undefined }}>
          {needed > 0 ? `${people.length}/${needed}` : people.length}
        </b>
      </h4>
      {shown.map((member, index) => {
        const tag = TIMESHEET_TAGS[member.timesheetStatus] ?? TIMESHEET_TAGS.missing;
        return (
          <div key={`${member.name}-${index}`} className="wb-person">
            <span className="wb-person-name">{member.name || 'Sin nombre'}</span>
            <span className="wb-person-role">{member.role}</span>
            {showTimesheets ? <span className={`wb-ts ${TONE_CLASS[tag.tone]}`}>{tag.label}</span> : null}
          </div>
        );
      })}
      {hiddenPeople > 0 ? <span className="wb-more">+{hiddenPeople} más</span> : null}
      {Array.from({ length: vacancySlots }, (_, index) => (
        <div key={`vacante-${index}`} className="wb-person is-vacant">
          <span className="wb-person-name">Vacante</span>
          <span className="wb-person-role">Sin asignar</span>
        </div>
      ))}
      {hiddenVacancies > 0 ? (
        <span className="wb-more">+{hiddenVacancies} {hiddenVacancies === 1 ? 'vacante' : 'vacantes'} más</span>
      ) : null}
    </div>
  );
};

export const CrewAssignmentsPanel = ({
  data,
  page = 0,
  now = new Date(),
}: {
  data: CrewAssignmentsFeed | null;
  page?: number;
  now?: Date;
}) => {
  const jobs = data?.jobs ?? [];
  if (!jobs.length) return <EmptyState>No hay trabajos para mostrar</EmptyState>;

  return (
    <div className="wb-body wb-grid-2">
      {paginate(jobs, page, PANEL_PAGE_SIZES.crew).map((job) => {
        const jobEnded = job.end_time ? new Date(job.end_time).getTime() < now.getTime() : false;
        return (
          <article key={job.id} className="wb-card wb-crew">
            <div className="wb-job-head">
              <JobSwatch color={job.color} />
              <span className="wb-job-name">{job.title}</span>
            </div>
            {job.start_time && job.end_time ? (
              <div className="wb-job-meta"><b>{formatJobWhen(job.start_time, job.end_time, now)}</b></div>
            ) : null}
            <div className="wb-crew-cols">
              {DEPARTMENTS.map((dept) => <CrewColumn key={dept} job={job} dept={dept} jobEnded={jobEnded} />)}
            </div>
          </article>
        );
      })}
    </div>
  );
};
