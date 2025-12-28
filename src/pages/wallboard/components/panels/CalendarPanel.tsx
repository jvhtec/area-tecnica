import React, { useEffect, useState } from 'react';
import type { CalendarFeed, JobsOverviewJob } from '../../types';
import { buildCalendarModel } from '../../calendar';
import { getDateTypeForJobOnDay, getDateTypeIcon, getJobCardBackground } from '../../utils';
import { AutoScrollWrapper, PanelContainer, StatusDot } from '../shared';

const MAX_JOBS_PER_DAY_CELL = 3;
const DAY_CELL_ROTATE_MS = 5000;

const CalendarCellJobsList: React.FC<{
  jobs: JobsOverviewJob[];
  highlightSet: Set<string>;
  theme: 'light' | 'dark';
  cellKey: string;
  cellDate: Date;
}> = ({ jobs, highlightSet, theme, cellKey, cellDate }) => {
  const [start, setStart] = useState(0);

  useEffect(() => {
    setStart(0);
    if (jobs.length <= MAX_JOBS_PER_DAY_CELL) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (cancelled) return;
      setStart((prev) => {
        if (jobs.length <= MAX_JOBS_PER_DAY_CELL) return 0;
        const next = prev + MAX_JOBS_PER_DAY_CELL;
        return next >= jobs.length ? 0 : next;
      });
    }, DAY_CELL_ROTATE_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [cellKey, jobs]);

  const end = Math.min(jobs.length, start + MAX_JOBS_PER_DAY_CELL);
  const visible = jobs.slice(start, end);

  return (
    <div className="flex-1 space-y-1 overflow-hidden">
      {visible.map((job) => {
        const highlight = highlightSet.has(job.id);
        const time = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateTypeIcon = getDateTypeIcon(
          getDateTypeForJobOnDay({ id: job.id, job_type: (job as any).job_type, start_time: job.start_time, end_time: job.end_time }, cellDate)
        );
        return (
          <div
            key={job.id}
            className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs border ${
              highlight ? 'border-amber-400' : theme === 'light' ? 'border-zinc-200' : 'border-zinc-700'
            }`}
            style={{ backgroundColor: getJobCardBackground((job as any).color, theme) }}
          >
            <StatusDot color={job.status} />
            <div className="flex-1 truncate">
              <div className="font-semibold truncate text-sm">{job.title}</div>
              <div className={`text-xs flex gap-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                <span className="tabular-nums">{time}</span>
                {job.departments.length > 0 && <span className="uppercase">{job.departments.join('/')}</span>}
              </div>
            </div>
            {dateTypeIcon && (
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center ${
                  theme === 'light' ? 'bg-white/70 text-zinc-700' : 'bg-black/40 text-zinc-100'
                }`}
              >
                {dateTypeIcon}
              </div>
            )}
          </div>
        );
      })}
      {jobs.length > end && (
        <div className={`text-xs text-center ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>+{jobs.length - end} más</div>
      )}
    </div>
  );
};

export const CalendarPanel: React.FC<{
  data: CalendarFeed | null;
  highlightIds?: Set<string>;
  theme?: 'light' | 'dark';
  scrollSpeed?: number;
}> = ({ data, highlightIds, theme = 'light', scrollSpeed = 50 }) => {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds, true);
  const resetKey = data ? `${data.range.start}-${data.range.end}-${data.jobs.length}` : 'no-data';

  return (
    <AutoScrollWrapper speed={scrollSpeed} resetKey={resetKey}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-end justify-between gap-6">
            <div>
              <h1 className="text-5xl font-semibold leading-tight">Calendario de Trabajos</h1>
              <div className={`text-38 uppercase tracking-[0.35em] mt-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {monthLabel}
              </div>
            </div>
            <div className={`text-right text-2xl max-w-[28rem] leading-snug ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Vista del mes actual con visualización compacta de trabajos
            </div>
          </div>
          <div className={`grid grid-cols-7 gap-2 uppercase tracking-[0.35em] text-xl font-semibold pt-2 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {dayNames.map((name) => (
              <div key={name} className="text-center">
                {name}
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2" style={{ gridAutoRows: 'minmax(12rem, auto)' }}>
          {cells.map((cell, idx) => {
            const jobs = cell.jobs;
            const highlightSet = cell.highlightJobIds;
            const classes = [
              'rounded-lg border p-3 flex flex-col gap-2 shadow-inner transition-all duration-300',
              theme === 'light'
                ? cell.inMonth
                  ? 'bg-white border-zinc-200 text-zinc-900'
                  : 'bg-zinc-50 border-zinc-100 text-zinc-400'
                : cell.inMonth
                  ? 'bg-zinc-950/90 border-zinc-800 text-white'
                  : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-500',
              cell.isToday ? 'border-blue-400/80 ring-2 ring-blue-400/30 shadow-[0_0_45px_rgba(96,165,250,0.35)]' : '',
              cell.hasHighlight ? 'border-amber-400/80 ring-4 ring-amber-400/30 shadow-[0_0_55px_rgba(251,191,36,0.35)]' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={cell.isoKey + idx} className={classes}>
                <div className="flex items-start justify-between">
                  <div className={`text-38 font-bold leading-none ${cell.inMonth ? '' : theme === 'light' ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {cell.date.getDate()}
                  </div>
                  {jobs.length > 0 && (
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 text-lg font-semibold tabular-nums">
                      {jobs.length}
                    </div>
                  )}
                </div>
                <CalendarCellJobsList jobs={jobs} highlightSet={highlightSet} theme={theme} cellKey={cell.isoKey} cellDate={cell.date} />
              </div>
            );
          })}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

