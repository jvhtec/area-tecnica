import React from 'react';
import type { JobsOverviewFeed } from '../../types';
import {
  formatJobDateTypeLabel,
  formatJobTypeLabel,
  getDateTypeForJobOnDay,
  getDateTypeIcon,
  getJobCardBackground,
} from '../../utils';
import { WALLBOARD_PANEL_PAGE_SIZES } from '../../panelPageSizes';
import { AutoScrollWrapper, PanelContainer, StatusDot } from '../shared';

export const JobsOverviewPanel: React.FC<{
  data: JobsOverviewFeed | null;
  highlightIds?: Set<string>;
  page?: number;
  pageSize?: number;
  theme?: 'light' | 'dark';
}> = ({ data, highlightIds, page = 0, pageSize = WALLBOARD_PANEL_PAGE_SIZES.overview, theme = 'light' }) => {
  const jobs = data?.jobs ?? [];
  const paginatedJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(jobs.length / pageSize);

  return (
    <AutoScrollWrapper speed={50} resetKey={page}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-semibold">Trabajos – Próximos días</h1>
            {totalPages > 1 && (
              <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Página {page + 1} de {totalPages}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedJobs.map((j) => {
            const jt = j.job_type || '';
            const jtKey = String(jt).toLowerCase();
            const dateTypeIcon = getDateTypeIcon(
              getDateTypeForJobOnDay({ id: j.id, job_type: jtKey, start_time: j.start_time, end_time: j.end_time }, new Date(j.start_time))
            );
            return (
              <div
                key={j.id}
                className={`rounded-lg p-4 border shadow-sm ${
                  highlightIds?.has(j.id)
                    ? theme === 'light'
                      ? 'border-amber-500 ring-4 ring-amber-400/40 animate-pulse'
                      : 'border-amber-400 ring-4 ring-amber-400/40 animate-pulse'
                    : theme === 'light'
                      ? 'border-zinc-200'
                      : 'border-zinc-800'
                }`}
                style={{ backgroundColor: getJobCardBackground(j.color, theme) }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-38 font-medium truncate pr-2">{j.title}</div>
                  <div className="flex items-center gap-2">
                    <StatusDot color={j.status} />
                    {dateTypeIcon && (
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center ${
                          theme === 'light' ? 'bg-white/80 text-zinc-700' : 'bg-black/40 text-zinc-100'
                        }`}
                      >
                        {dateTypeIcon}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {formatJobTypeLabel(jt) && (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        theme === 'light' ? 'bg-white/70 text-blue-800 border-blue-200' : 'bg-black/40 text-blue-200 border-blue-700/60'
                      }`}
                    >
                      {formatJobTypeLabel(jt)}
                    </span>
                  )}
                  {formatJobDateTypeLabel(j.start_time, j.end_time) && (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        theme === 'light' ? 'bg-white/70 text-zinc-800 border-zinc-300' : 'bg-black/40 text-zinc-200 border-zinc-700/60'
                      }`}
                    >
                      {formatJobDateTypeLabel(j.start_time, j.end_time)}
                    </span>
                  )}
                </div>
                <div className={`text-30 mt-1 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}`}>{j.location?.name ?? '—'}</div>
                <div className={`mt-2 text-32 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {new Date(j.start_time).toLocaleString()} →{' '}
                  {new Date(j.start_time).toDateString() === new Date(j.end_time).toDateString()
                    ? new Date(j.end_time).toLocaleTimeString()
                    : new Date(j.end_time).toLocaleString()}
                </div>
                <div className="mt-3 flex gap-6 text-30">
                  {j.departments.map((d) => (
                    <div key={d} className="flex items-center gap-2">
                      <span className="text-38">{d === 'sound' ? '🎧' : d === 'lights' ? '💡' : '📹'}</span>
                      <span className="tabular-nums">
                        {j.crewAssigned[d] || 0}/{j.crewNeeded[d] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={`mt-2 text-2xl ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Docs: {j.departments.map((d) => `${d[0].toUpperCase()}${d.slice(1)} ${j.docs[d]?.have ?? 0}/${j.docs[d]?.need ?? 0}`).join(' • ')}
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay trabajos en los próximos 7 días</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};
