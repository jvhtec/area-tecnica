import React from 'react';
import type { CrewAssignmentsFeed } from '../../types';
import {
  formatJobDateTypeLabel,
  formatJobTypeLabel,
  getDateTypeForJobOnDay,
  getDateTypeIcon,
  getJobCardBackground,
  translateTimesheetStatus,
} from '../../utils';
import { AutoScrollWrapper, PanelContainer } from '../shared';

export const CrewAssignmentsPanel: React.FC<{
  data: CrewAssignmentsFeed | null;
  page?: number;
  pageSize?: number;
  theme?: 'light' | 'dark';
}> = ({ data, page = 0, pageSize = 4, theme = 'light' }) => {
  const jobs = data?.jobs ?? [];
  const paginatedJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(jobs.length / pageSize);

  return (
    <AutoScrollWrapper speed={50} resetKey={page}>
      <PanelContainer theme={theme}>
        <div className={`sticky top-0 z-10 pb-4 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-5xl font-semibold">Asignaciones de Equipo</h1>
            {totalPages > 1 && (
              <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Página {page + 1} de {totalPages}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {paginatedJobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-lg p-4 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}
              style={{ backgroundColor: getJobCardBackground((job as any).color, theme) }}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-38 font-medium">{job.title}</div>
                  {getDateTypeIcon(
                    getDateTypeForJobOnDay(
                      { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                      new Date((job as any).start_time || '')
                    )
                  ) && (
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        theme === 'light' ? 'bg-white/80 text-zinc-700' : 'bg-black/40 text-zinc-100'
                      }`}
                    >
                      {getDateTypeIcon(
                        getDateTypeForJobOnDay(
                          { id: job.id, job_type: (job as any).jobType, start_time: (job as any).start_time || '', end_time: (job as any).end_time || '' },
                          new Date((job as any).start_time || '')
                        )
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {formatJobTypeLabel((job as any).jobType || (job as any).job_type) && (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        theme === 'light' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-900/40 text-blue-200 border-blue-700/60'
                      }`}
                    >
                      {formatJobTypeLabel((job as any).jobType || (job as any).job_type)}
                    </span>
                  )}
                  {formatJobDateTypeLabel((job as any).start_time, (job as any).end_time) && (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${
                        theme === 'light' ? 'bg-zinc-50 text-zinc-700 border-zinc-300' : 'bg-zinc-900/40 text-zinc-200 border-zinc-700/60'
                      }`}
                    >
                      {formatJobDateTypeLabel((job as any).start_time, (job as any).end_time)}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {job.crew.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="text-38">
                        {c.dept === 'sound' ? '🎧' : c.dept === 'lights' ? '💡' : c.dept === 'video' ? '📹' : '👤'}
                      </span>
                      <div className="truncate">
                        <div className="text-32 truncate">{c.name || '—'}</div>
                        <div className={`text-xl truncate ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>{c.role}</div>
                      </div>
                    </div>
                    {String(((job as any).jobType || (job as any).job_type || '')).toLowerCase() !== 'tourdate' && (
                      <div
                        className={`px-2 py-1 rounded text-xl ${
                          c.timesheetStatus === 'approved'
                            ? 'bg-green-600'
                            : c.timesheetStatus === 'submitted'
                              ? 'bg-blue-600'
                              : c.timesheetStatus === 'draft'
                                ? 'bg-amber-600'
                                : 'bg-red-600'
                        } text-white`}
                      >
                        {translateTimesheetStatus(c.timesheetStatus)}
                      </div>
                    )}
                  </div>
                ))}
                {job.crew.length === 0 && (
                  <div className={`text-30 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Aún no hay equipo asignado</div>
                )}
              </div>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay trabajos para mostrar</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

