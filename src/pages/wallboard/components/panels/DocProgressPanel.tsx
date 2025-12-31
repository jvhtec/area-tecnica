import React from 'react';
import type { DocProgressFeed } from '../../types';
import { getDateTypeForJobOnDay, getDateTypeIcon, getJobCardBackground } from '../../utils';
import { AutoScrollWrapper, PanelContainer } from '../shared';

export const DocProgressPanel: React.FC<{
  data: DocProgressFeed | null;
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
            <h1 className="text-5xl font-semibold">Progreso de Documentos</h1>
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
              <div className="flex items-center justify-between gap-2 mb-3">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {job.departments.map((dep) => {
                  const pct = dep.need > 0 ? Math.round((dep.have / dep.need) * 100) : 0;
                  return (
                    <div key={dep.dept} className={`rounded-md p-3 ${theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-800/50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-32 flex items-center gap-2">
                          <span className="text-38">{dep.dept === 'sound' ? '🎧' : dep.dept === 'lights' ? '💡' : '📹'}</span>
                          <span className="capitalize">{dep.dept}</span>
                        </div>
                        <div className={`text-2xl ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}`}>{dep.have}/{dep.need}</div>
                      </div>
                      <div className={`h-3 rounded ${theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-700'}`}>
                        <div className="h-3 bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                      {dep.missing.length > 0 && (
                        <div className={`text-xl mt-2 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                          Faltante: {dep.missing.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {jobs.length === 0 && <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>Nada pendiente</div>}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};

