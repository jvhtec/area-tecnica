import { useState } from 'react';

import { TRANSPORT_PROVIDERS, type TransportProvider } from '@/constants/transportProviders';

import type { LogisticsItem } from '../../types';
import { formatDayHeading } from '../../format';
import {
  PANEL_PAGE_SIZES,
  getDeptLabel,
  getProcedureLabel,
  getVehicleLabel,
  groupLogisticsByDay,
  paginate,
} from '../../model';
import { EmptyState, JobSwatch } from '../shared';

const isTransportProvider = (value: unknown): value is TransportProvider =>
  typeof value === 'string' && value in TRANSPORT_PROVIDERS;

/** Fixed-size slot so every row lines up; falls back to the provider name. */
const ProviderSlot = ({ provider }: { provider: string | null | undefined }) => {
  const [failed, setFailed] = useState(false);
  if (!isTransportProvider(provider)) return <div className="wb-provider" />;
  const entry = TRANSPORT_PROVIDERS[provider];
  return (
    <div className="wb-provider">
      {entry.icon && !failed ? (
        <img
          src={entry.icon}
          alt={entry.label}
          className={entry.tone === 'light' ? 'is-light-tone' : undefined}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{entry.label}</span>
      )}
    </div>
  );
};

export const LogisticsPanel = ({
  data,
  page = 0,
  now = new Date(),
}: {
  data: LogisticsItem[] | null;
  page?: number;
  now?: Date;
}) => {
  const items = data ?? [];
  if (!items.length) return <EmptyState>No hay movimientos de logística en los próximos 7 días</EmptyState>;

  const days = groupLogisticsByDay(paginate(items, page, PANEL_PAGE_SIZES.logistics));

  return (
    <div className="wb-body" style={{ gap: 'calc(var(--u) * 0.6)' }}>
      {days.map((day) => {
        const heading = formatDayHeading(day.dateKey, now);
        return (
          <section key={day.dateKey} style={{ display: 'contents' }}>
            <div className="wb-day">
              {heading.relative ? <b>{heading.relative}</b> : null}
              {heading.label}
            </div>
            {day.items.map((item) => {
              const procedure = getProcedureLabel(item.procedure);
              const departments = item.departments.map(getDeptLabel).join(' · ');
              return (
                <div key={item.id} className="wb-move">
                  <span className="wb-move-time">{item.time?.slice(0, 5) || '—'}</span>
                  <span className={`wb-proc${procedure.tone === 'other' ? '' : ` is-${procedure.tone}`}`}>{procedure.label}</span>
                  <div className="wb-move-main">
                    <span className="wb-move-title"><JobSwatch color={item.color} />{item.title}</span>
                    <span className="wb-move-sub">
                      <span>
                        {getVehicleLabel(item.transport_type)}
                        {item.plate ? <> · <span className="wb-mono">{item.plate}</span></> : null}
                      </span>
                      {departments ? <span>{departments}</span> : null}
                      {item.notes ? <span>{item.notes}</span> : null}
                    </span>
                  </div>
                  <ProviderSlot provider={item.transport_provider} />
                  <div className="wb-bay">
                    <small>Muelle</small>
                    <b>{item.loadingBay || '—'}</b>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
};
