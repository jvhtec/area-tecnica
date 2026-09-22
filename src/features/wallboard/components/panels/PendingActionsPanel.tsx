import type { CSSProperties } from 'react';

import type { PendingActionsFeed } from '../../types';
import { formatRelativeDay } from '../../format';
import {
  PANEL_PAGE_SIZES,
  PENDING_TAGS,
  describePendingItem,
  getPendingTotals,
  groupPendingItems,
  paginate,
} from '../../model';
import { EmptyState, JobSwatch } from '../shared';

const kpiStyle = (color: string): CSSProperties & { '--kpi-color': string } => ({ '--kpi-color': color });

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const PendingActionsPanel = ({
  data,
  page = 0,
  now = new Date(),
}: {
  data: PendingActionsFeed | null;
  page?: number;
  now?: Date;
}) => {
  const items = data?.items ?? [];
  if (!items.length) return <EmptyState ok>Todo en orden ✓</EmptyState>;

  const totals = getPendingTotals(items);
  const groups = paginate(groupPendingItems(items), page, PANEL_PAGE_SIZES.pending);

  return (
    <div className="wb-body" style={{ gap: 'calc(var(--u) * 1.2)' }}>
      {totals.structured ? (
        <div className="wb-kpis">
          <div className="wb-kpi" style={kpiStyle(totals.staffing ? 'var(--wb-crit)' : 'var(--wb-ok)')}>
            <b>{totals.staffing}</b>
            <span>
              {plural(totals.staffing, 'plaza sin cubrir', 'plazas sin cubrir')}
              <small>{totals.staffingJobs} {plural(totals.staffingJobs, 'trabajo', 'trabajos')} · próximos 7 días</small>
            </span>
          </div>
          <div className="wb-kpi" style={kpiStyle(totals.docsMissing ? 'var(--wb-crit)' : 'var(--wb-ok)')}>
            <b>{totals.docsMissing}</b>
            <span>
              {plural(totals.docsMissing, 'documento que falta', 'documentos que faltan')}
              <small>trabajos en las próximas 72 h</small>
            </span>
          </div>
          <div className="wb-kpi" style={kpiStyle(totals.timesheets ? 'var(--wb-warn)' : 'var(--wb-ok)')}>
            <b>{totals.timesheets}</b>
            <span>
              {plural(totals.timesheets, 'parte de horas vencido', 'partes de horas vencidos')}
              <small>{totals.timesheetJobs} {plural(totals.timesheetJobs, 'trabajo terminado', 'trabajos terminados')}</small>
            </span>
          </div>
        </div>
      ) : null}
      <div className="wb-grid-2" style={{ display: 'grid', gap: 'calc(var(--u) * 1)', alignContent: 'start' }}>
        {groups.map((group) => (
          <article key={group.key} className="wb-card wb-alert-group">
            <div className="wb-alert-head">
              <JobSwatch color={group.color} />
              <span>{group.title}</span>
              {group.startTime ? <span className="wb-mono">{formatRelativeDay(group.startTime, now)}</span> : null}
            </div>
            {group.items.map((item, index) => (
              <div key={`${item.kind ?? 'item'}-${index}`} className="wb-alert">
                <span className={`wb-tag ${item.severity === 'red' ? 'wb-crit' : 'wb-warn'}`}>
                  {item.kind ? PENDING_TAGS[item.kind] : item.severity === 'red' ? 'URGENTE' : 'AVISO'}
                </span>
                {describePendingItem(item)}
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
};
