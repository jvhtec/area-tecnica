import type { CalendarFeed } from '../../types';
import { buildCalendarModel } from '../../calendar';
import { formatShortMonth } from '../../format';
import { getJobReadiness } from '../../model';
import { JobSwatch } from '../shared';

const MAX_EVENTS_PER_DAY = 3;

/** Busy days show two entries plus a counter so the counter always fits the cell. */
const visibleCount = (total: number) => (total > MAX_EVENTS_PER_DAY ? MAX_EVENTS_PER_DAY - 1 : total);

export const CalendarPanel = ({
  data,
  highlightIds,
  now = new Date(),
}: {
  data: CalendarFeed | null;
  highlightIds?: Set<string>;
  now?: Date;
}) => {
  const { dayNames, cells } = buildCalendarModel(data, highlightIds);
  const rows = Math.max(1, Math.ceil(cells.length / 7));

  return (
    <div className="wb-body wb-calendar" style={{ gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))` }}>
      {dayNames.map((name) => (
        <div key={name} className="wb-day-name">{name}</div>
      ))}
      {cells.map((cell, index) => {
        const [, , day] = cell.isoKey.split('-');
        const showMonth = index > 0 && day === '01';
        const classes = [
          'wb-cal-cell',
          cell.isWeekend ? 'is-weekend' : '',
          cell.isToday ? 'is-today' : '',
          cell.hasHighlight ? 'is-highlight' : '',
        ].filter(Boolean).join(' ');
        return (
          <div key={cell.isoKey} className={classes}>
            <div className="wb-cal-date">
              {Number(day)}
              {cell.isToday ? <small>hoy</small> : showMonth ? <small>{formatShortMonth(cell.isoKey)}</small> : null}
            </div>
            {cell.jobs.slice(0, visibleCount(cell.jobs.length)).map((job) => {
              const urgency = getJobReadiness(job, now).urgency;
              // Status only colours the entry when there is a problem, so a quiet calendar looks quiet.
              return (
                <div key={job.id} className={`wb-event${urgency === 'ok' ? '' : ` is-${urgency}`}`}>
                  <JobSwatch color={job.color} small />
                  <span>{job.title}</span>
                </div>
              );
            })}
            {cell.jobs.length > MAX_EVENTS_PER_DAY ? (
              <span className="wb-more">+{cell.jobs.length - visibleCount(cell.jobs.length)} más</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
