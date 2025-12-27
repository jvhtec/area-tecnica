import React from 'react';
import { TRANSPORT_PROVIDERS } from '@/constants/transportProviders';
import type {
  CalendarFeed,
  CrewAssignmentsFeed,
  DocProgressFeed,
  JobsOverviewFeed,
  LogisticsItem,
  PendingActionsFeed,
} from '../../types';
import { buildCalendarModel } from '../../calendar';
import { AlienShell } from './AlienShell';

export const AlienCalendarPanel: React.FC<{ data: CalendarFeed | null; highlightIds?: Set<string> }> = ({ data, highlightIds }) => {
  const { dayNames, monthLabel, cells } = buildCalendarModel(data, highlightIds);
  return (
    <AlienShell title={`VENTANA DE CALENDARIO – ${monthLabel.toUpperCase()}`} kind="tracker">
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2 text-[10px] uppercase tracking-[0.35em] text-amber-300">
          {dayNames.map((name) => (
            <div key={name} className="text-center">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 auto-rows-fr">
          {cells.map((cell, idx) => {
            const jobs = cell.jobs;
            const highlightSet = cell.highlightJobIds;
            const classes = [
              'border border-[var(--alien-border-dim)] bg-black/70 p-3 flex flex-col gap-2 min-h-[12rem] transition-all duration-300',
              cell.inMonth ? 'text-amber-200' : 'text-amber-400/50',
              cell.isToday ? 'border-blue-400 text-blue-200 shadow-[0_0_35px_rgba(96,165,250,0.35)]' : '',
              cell.hasHighlight ? 'bg-amber-400/25 border-amber-300 text-black shadow-[0_0_40px_rgba(251,191,36,0.45)]' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={cell.isoKey + idx} className={classes}>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold tabular-nums">{cell.date.getDate().toString().padStart(2, '0')}</div>
                  {jobs.length > 0 && <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">{jobs.length} evt</div>}
                </div>
                <div className="flex-1 space-y-1">
                  {jobs.slice(0, 4).map((job) => {
                    const highlight = highlightSet.has(job.id);
                    const time = new Date(job.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const jobClasses = highlight
                      ? 'px-2 py-1 bg-amber-300 text-black font-bold uppercase tracking-[0.2em]'
                      : 'px-2 py-1 border border-[var(--alien-border-dim)] text-amber-200 uppercase tracking-[0.2em]';
                    return (
                      <div key={job.id} className={jobClasses}>
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="tabular-nums">{time}</span>
                          <span className="text-[9px] text-amber-400/80">{job.departments.join('/')}</span>
                        </div>
                        <div className="text-[11px] truncate">{job.title}</div>
                        {job.location?.name && <div className="text-[9px] text-amber-400/70 truncate">{job.location.name}</div>}
                      </div>
                    );
                  })}
                  {jobs.length > 4 && <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300">+{jobs.length - 4} MÁS</div>}
                  {jobs.length === 0 && <div className="text-[11px] text-amber-500/40 uppercase tracking-[0.4em]">—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AlienShell>
  );
};

export const AlienJobsPanel: React.FC<{ data: JobsOverviewFeed | null; highlightIds?: Set<string> }> = ({ data, highlightIds }) => (
  <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 min-h-[calc(100vh-120px)]">
    {(data?.jobs ?? []).map((j) => (
      <AlienShell key={j.id} title="RESUMEN DE TRABAJOS - OPERACIONES">
        <div className="space-y-2">
          <div className={`flex justify-between items-center ${highlightIds?.has(j.id) ? 'animate-pulse' : ''}`}>
            <div className={`text-amber-100 text-sm font-bold uppercase tracking-wider ${highlightIds?.has(j.id) ? 'bg-amber-400 text-black px-1' : ''}`}>
              {j.title}
            </div>
            <div className={`w-2 h-2 ${j.status === 'green' ? 'bg-green-400 animate-pulse' : j.status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'}`} />
          </div>
          <div className="text-amber-300 text-xs">{j.location?.name ?? '—'}</div>
          <div className="text-amber-200 text-xs tabular-nums">
            {new Date(j.start_time).toLocaleString()} → {new Date(j.end_time).toLocaleTimeString()}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {j.departments.map((d) => (
              <div key={d} className="border border-[var(--alien-border-dim)] p-2">
                <div className="uppercase text-amber-300 text-[10px]">{d}</div>
                <div className="text-amber-100 text-xs tabular-nums">{j.crewAssigned[d] || 0} equipo</div>
                <div className="text-amber-200 text-[10px]">
                  docs {j.docs[d]?.have ?? 0}/{j.docs[d]?.need ?? 0}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AlienShell>
    ))}
    {(!data || data.jobs.length === 0) && (
      <AlienShell title="RESUMEN DE TRABAJOS - OPERACIONES">
        <div className="text-amber-300">NO HAY TRABAJOS EN VENTANA</div>
      </AlienShell>
    )}
  </div>
);

export const AlienCrewPanel: React.FC<{ data: CrewAssignmentsFeed | null }> = ({ data }) => (
  <AlienShell title="ESTADO DEL EQUIPO - MONITOR BIOSIGN" kind="tracker">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {(data?.jobs ?? []).map((job) => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="space-y-1">
            {job.crew.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 ${
                      c.timesheetStatus === 'approved'
                        ? 'bg-green-400 animate-pulse'
                        : c.timesheetStatus === 'submitted'
                          ? 'bg-blue-400'
                          : c.timesheetStatus === 'draft'
                            ? 'bg-yellow-400'
                            : 'bg-red-400'
                    }`}
                  />
                  <span className="truncate">
                    {c.name || '—'} ({c.dept || '—'})
                  </span>
                </div>
                <div className="uppercase text-amber-300 text-[10px]">{c.role}</div>
              </div>
            ))}
            {job.crew.length === 0 && <div className="text-amber-300 text-xs">NO HAY EQUIPO ASIGNADO</div>}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length === 0) && <div className="text-amber-300">NO HAY TRABAJOS</div>}
    </div>
  </AlienShell>
);

export const AlienDocsPanel: React.FC<{ data: DocProgressFeed | null }> = ({ data }) => (
  <AlienShell title="DOCUMENTACIÓN - CONTROL AMBIENTAL" kind="env">
    <div className="space-y-2">
      {(data?.jobs ?? []).map((job) => (
        <div key={job.id} className="border border-[var(--alien-border-dim)] p-2">
          <div className="uppercase text-amber-100 text-xs font-bold tracking-wider mb-1">{job.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {job.departments.map((dep) => {
              const pct = dep.need > 0 ? Math.round((dep.have / dep.need) * 100) : 0;
              return (
                <div key={dep.dept}>
                  <div className="flex justify-between items-center text-amber-300 text-[10px] uppercase mb-1">
                    <span>{dep.dept}</span>
                    <span>
                      {dep.have}/{dep.need}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-black border border-blue-400/50">
                    <div className={`${pct < 100 ? 'bg-blue-400' : 'bg-green-400'} h-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {(!data || data.jobs.length === 0) && <div className="text-amber-300">NO HAY PROGRESO DE DOCUMENTOS DISPONIBLE</div>}
    </div>
  </AlienShell>
);

export const AlienPendingPanel: React.FC<{ data: PendingActionsFeed | null }> = ({ data }) => (
  <AlienShell title="ALERTAS DEL SISTEMA - PROTOCOLO DE EMERGENCIA" kind="critical">
    <div className="space-y-2">
      {(data?.items ?? []).map((it, i) => (
        <div key={i} className={`px-2 py-1 text-xs font-mono ${it.severity === 'red' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-black'}`}>
          {it.text}
        </div>
      ))}
      {(data?.items.length ?? 0) === 0 && <div className="text-amber-300">TODOS LOS SISTEMAS NOMINALES</div>}
    </div>
  </AlienShell>
);

export const AlienLogisticsPanel: React.FC<{ data: LogisticsItem[] | null }> = ({ data }) => (
  <AlienShell title="LOGÍSTICA - ESCANEO DE PROXIMIDAD" kind="tracker">
    <div className="space-y-2">
      {(data ?? []).map((ev) => (
        <div key={ev.id} className="border border-[var(--alien-border-dim)] p-2 flex items-center justify-between text-amber-200 text-xs">
          <div className="flex items-center gap-3 flex-1">
            <div className="font-mono tabular-nums">
              {ev.date} {ev.time?.slice(0, 5)}
            </div>
            <div className="flex-1">
              <div className="uppercase text-amber-100">{ev.title}</div>
              <div className="flex flex-wrap gap-2 text-[10px] text-amber-200 mt-1">
                {ev.procedure ? <span className="border border-[var(--alien-border-dim)] px-1 py-0.5 uppercase">{ev.procedure.replace(/_/g, ' ')}</span> : null}
                <span className="uppercase">{ev.transport_type || 'transport'}</span>
                {ev.loadingBay && <span className="uppercase">Bay {ev.loadingBay}</span>}
                {ev.plate && <span className="uppercase text-amber-300">Plate {ev.plate}</span>}
              </div>
              {ev.departments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-amber-300">
                  {ev.departments.map((dep) => (
                    <span key={dep} className="border border-[var(--alien-border-dim)] px-1 py-0.5 uppercase tracking-wide">
                      {dep}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {ev.transport_provider && TRANSPORT_PROVIDERS[ev.transport_provider] && TRANSPORT_PROVIDERS[ev.transport_provider].icon && (
            <div className="flex-shrink-0 ml-4">
              <img
                src={TRANSPORT_PROVIDERS[ev.transport_provider].icon}
                alt={TRANSPORT_PROVIDERS[ev.transport_provider].label}
                className="w-32 h-32 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      ))}
      {(!data || data.length === 0) && <div className="text-amber-300">NO HAY LOGÍSTICA EN VENTANA</div>}
    </div>
  </AlienShell>
);

