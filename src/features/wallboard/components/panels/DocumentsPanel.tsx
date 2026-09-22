import type { JobsOverviewFeed } from '../../types';
import { formatStartsIn } from '../../format';
import { DEPARTMENTS, DEPT_LABELS, PANEL_PAGE_SIZES, docStateFor, getDocColumns, getDocJobs, paginate } from '../../model';
import { EmptyState, JobSwatch } from '../shared';

const CELL = {
  delivered: { className: 'is-delivered', mark: '✓' },
  pending: { className: 'is-pending', mark: '✕' },
  missing: { className: 'is-missing', mark: '✕' },
} as const;

/**
 * Jobs as rows, required documents as columns grouped by department. Built from
 * the per-document checklist in the snapshot, so a column only exists once a
 * requirement is configured in required_docs.
 */
export const DocumentsPanel = ({
  data,
  page = 0,
  now = new Date(),
}: {
  data: JobsOverviewFeed | null;
  page?: number;
  now?: Date;
}) => {
  const jobs = getDocJobs(data);
  const columns = getDocColumns(jobs);
  if (!jobs.length || !columns.length) {
    return <EmptyState>No hay requisitos documentales para los próximos 7 días</EmptyState>;
  }

  const groups = DEPARTMENTS
    .map((dept) => ({ dept, columns: columns.filter((column) => column.dept === dept) }))
    .filter((group) => group.columns.length > 0);

  return (
    <div className="wb-body">
      <div className="wb-matrix">
        <table>
          <thead>
            <tr className="is-group">
              <th className="is-left" />
              <th />
              {groups.map((group) => (
                <th key={group.dept} className="is-group-start" colSpan={group.columns.length}>
                  {DEPT_LABELS[group.dept].toUpperCase()}
                </th>
              ))}
              <th className="is-group-start" />
            </tr>
            <tr>
              <th className="is-left">Trabajo</th>
              <th>Inicio</th>
              {groups.flatMap((group) =>
                group.columns.map((column, index) => (
                  <th key={`${column.dept}:${column.key}`} className={index === 0 ? 'is-group-start' : undefined}>
                    {column.label}
                  </th>
                )),
              )}
              <th className="is-group-start">Faltan</th>
            </tr>
          </thead>
          <tbody>
            {paginate(jobs, page, PANEL_PAGE_SIZES.docs).map((job) => {
              const open = (job.docChecklist ?? []).filter((item) => item.state !== 'delivered');
              const critical = open.some((item) => item.state === 'missing');
              return (
                <tr key={job.id}>
                  <td className="is-left">
                    <span className="wb-matrix-job"><JobSwatch color={job.color} />{job.title}</span>
                  </td>
                  <td className="wb-when">{formatStartsIn(job.start_time, now)}</td>
                  {groups.flatMap((group) =>
                    group.columns.map((column, index) => {
                      const state = docStateFor(job, column.dept, column.key);
                      const groupClass = index === 0 ? 'is-group-start' : undefined;
                      if (!state) {
                        return (
                          <td key={`${column.dept}:${column.key}`} className={groupClass}>
                            <span className="wb-cell is-na" aria-label="No aplica">—</span>
                          </td>
                        );
                      }
                      return (
                        <td key={`${column.dept}:${column.key}`} className={groupClass}>
                          <span className={`wb-cell ${CELL[state].className}`}>{CELL[state].mark}</span>
                        </td>
                      );
                    }),
                  )}
                  <td
                    className="is-group-start wb-left-count"
                    style={{ color: open.length === 0 ? 'var(--wb-ok)' : critical ? 'var(--wb-crit)' : 'var(--wb-warn)' }}
                  >
                    {open.length === 0 ? '✓' : open.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="wb-legend">
        <span><span className="wb-cell is-delivered">✓</span>Entregado</span>
        <span><span className="wb-cell is-pending">✕</span>Pendiente (≤ 7 días)</span>
        <span><span className="wb-cell is-missing">✕</span>Falta (≤ 72 h)</span>
        <span><span className="wb-cell is-na">—</span>No aplica</span>
      </div>
    </div>
  );
};
