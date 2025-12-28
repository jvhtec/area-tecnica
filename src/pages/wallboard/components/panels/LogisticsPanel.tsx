import React from 'react';
import { TRANSPORT_PROVIDERS } from '@/constants/transportProviders';
import type { LogisticsItem } from '../../types';
import { SPANISH_DAY_NAMES } from '../../calendar';
import { getJobCardBackground, getTransportIcon } from '../../utils';
import { AutoScrollWrapper, PanelContainer } from '../shared';

export const LogisticsPanel: React.FC<{
  data: LogisticsItem[] | null;
  page?: number;
  pageSize?: number;
  theme?: 'light' | 'dark';
}> = ({ data, page = 0, pageSize = 6, theme = 'light' }) => {
  const items = data ?? [];
  const paginatedItems = items.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(items.length / pageSize);

  return (
    <AutoScrollWrapper speed={75}>
      <PanelContainer theme={theme}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-5xl font-semibold">Logística – Próximos días</h1>
          {totalPages > 1 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Página {page + 1} de {totalPages}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {paginatedItems.map((ev) => (
            <div
              key={ev.id}
              className={`border rounded p-3 flex items-center justify-between ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'}`}
              style={{ backgroundColor: getJobCardBackground(ev.color || undefined, theme) }}
            >
              <div className="flex items-center gap-4 flex-1">
                <div>
                  <div className={`text-32 tabular-nums ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-200'}`}>
                    {ev.date} {ev.time?.slice(0, 5)}
                  </div>
                  <div className={`text-2xl font-semibold ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-100'}`}>
                    {SPANISH_DAY_NAMES[new Date(ev.date).getDay()]}
                  </div>
                </div>
                {getTransportIcon(ev.transport_type as any, ev.procedure as any, 'text-38')}
                <div className="flex-1">
                  <div className="text-38 font-medium">{ev.title}</div>
                  <div className={`mt-1 flex flex-wrap items-center gap-2 text-2xl ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    {ev.procedure ? (
                      <span className={`px-2 py-0.5 rounded capitalize ${theme === 'light' ? 'bg-zinc-200 text-zinc-700' : 'bg-zinc-800 text-zinc-200'}`}>
                        {ev.procedure.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                    <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}>{ev.transport_type || 'transport'}</span>
                    {ev.transport_provider &&
                      TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS] && (
                        <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}>
                          {TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS].label}
                        </span>
                      )}
                    {ev.loadingBay && <span className={theme === 'light' ? 'text-zinc-600' : 'text-zinc-300'}>Bay {ev.loadingBay}</span>}
                    {ev.plate && <span className={theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}>Plate {ev.plate}</span>}
                  </div>
                  {ev.departments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ev.departments.map((dep) => (
                        <span
                          key={dep}
                          className={`px-2 py-0.5 rounded text-lg uppercase tracking-wide ${
                            theme === 'light' ? 'bg-zinc-200 text-zinc-700' : 'bg-zinc-800 text-zinc-200'
                          }`}
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  )}
                  {ev.notes && <div className="text-sm opacity-80 line-clamp-1 mt-1">{ev.notes}</div>}
                </div>
              </div>
              {ev.transport_provider &&
                TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS] &&
                TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS].icon && (
                  <div className="flex-shrink-0 ml-4">
                    <img
                      src={TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS].icon!}
                      alt={TRANSPORT_PROVIDERS[ev.transport_provider as keyof typeof TRANSPORT_PROVIDERS].label}
                      width={192}
                      height={192}
                      loading="lazy"
                      decoding="async"
                      className="w-48 h-48 object-contain"
                      onError={(e) => {
                        console.error('Logo failed to load:', e.currentTarget.src);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
            </div>
          ))}
          {items.length === 0 && (
            <div className={`text-38 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>No hay logística en los próximos 7 días</div>
          )}
        </div>
      </PanelContainer>
    </AutoScrollWrapper>
  );
};
