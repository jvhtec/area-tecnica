import { describe, expect, it } from 'vitest';

import {
  getDocColumns,
  getJobReadiness,
  getPanelPageCount,
  getPendingTotals,
  getProcedureLabel,
  getVehicleLabel,
  groupPendingItems,
  sortByUrgency,
} from './model';
import type { JobsOverviewJob, PendingItem } from './types';

const NOW = new Date('2026-09-22T08:00:00.000Z');

const job = (overrides: Partial<JobsOverviewJob> = {}): JobsOverviewJob => ({
  id: 'job-1',
  title: 'Gala',
  start_time: '2026-09-27T16:00:00.000Z',
  end_time: '2026-09-27T21:00:00.000Z',
  location: { name: 'Palacio' },
  departments: ['sound', 'lights'],
  crewAssigned: { sound: 3, lights: 2, video: 0 },
  crewNeeded: { sound: 3, lights: 2, video: 0 },
  docs: {},
  docChecklist: [
    { dept: 'sound', key: 'pesos', label: 'Pesos', state: 'delivered' },
    { dept: 'lights', key: 'memoria', label: 'Memoria técnica de iluminación', state: 'delivered' },
  ],
  status: 'green',
  ...overrides,
});

describe('getJobReadiness', () => {
  it('is ready when crew and documents are complete', () => {
    expect(getJobReadiness(job(), NOW)).toMatchObject({ urgency: 'ok', label: 'LISTO' });
  });

  it('warns about a crew shortfall and pending documents a week out', () => {
    const readiness = getJobReadiness(job({
      crewAssigned: { sound: 1, lights: 2, video: 0 },
      docChecklist: [{ dept: 'sound', key: 'pesos', label: 'Pesos', state: 'pending' }],
      status: 'yellow',
    }), NOW);
    expect(readiness).toMatchObject({ urgency: 'warn', label: 'FALTAN 2 · 1 DOC', crewShort: 2 });
  });

  it('is critical when documents are missing inside 72 h', () => {
    const readiness = getJobReadiness(job({
      docChecklist: [
        { dept: 'sound', key: 'pesos', label: 'Pesos', state: 'missing' },
        { dept: 'sound', key: 'memoria', label: 'Memoria', state: 'missing' },
      ],
    }), NOW);
    expect(readiness).toMatchObject({ urgency: 'crit', label: 'CRÍTICO · 2 DOCS' });
  });

  it('sorts critical jobs ahead of earlier ready ones', () => {
    const ready = job({ id: 'ready', start_time: '2026-09-22T09:00:00.000Z' });
    const critical = job({
      id: 'critical',
      start_time: '2026-09-23T09:00:00.000Z',
      crewAssigned: { sound: 0, lights: 0, video: 0 },
      status: 'red',
    });
    expect(sortByUrgency([ready, critical], NOW).map((item) => item.id)).toEqual(['critical', 'ready']);
  });
});

describe('document columns', () => {
  it('orders columns by department and shortens long labels', () => {
    expect(getDocColumns([job()]).map((column) => `${column.dept}:${column.label}`)).toEqual([
      'sound:Pesos',
      'lights:Memoria',
    ]);
  });
});

describe('pending alerts', () => {
  const items: PendingItem[] = [
    { severity: 'yellow', text: 'a', kind: 'staffing', jobId: 'j1', jobTitle: 'Gira', count: 2, dept: 'sound' },
    { severity: 'red', text: 'b', kind: 'docs', jobId: 'j2', jobTitle: 'Gala', count: 3, detail: 'Sonido: pesos' },
    { severity: 'red', text: 'c', kind: 'staffing', jobId: 'j2', jobTitle: 'Gala', count: 1, dept: 'lights' },
    { severity: 'red', text: 'd', kind: 'timesheet', jobId: 'j3', jobTitle: 'Cruïlla', count: 4 },
  ];

  it('groups by job with red groups first', () => {
    expect(groupPendingItems(items).map((group) => [group.title, group.severity, group.items.length])).toEqual([
      ['Gala', 'red', 2],
      ['Cruïlla', 'red', 1],
      ['Gira', 'yellow', 1],
    ]);
  });

  it('totals the three headline figures', () => {
    expect(getPendingTotals(items)).toMatchObject({
      staffing: 3,
      staffingJobs: 2,
      docsMissing: 3,
      timesheets: 4,
      structured: true,
    });
  });

  it('pages the Atención panel by job group', () => {
    const many: PendingItem[] = Array.from({ length: 9 }, (_, index) => ({
      severity: 'red', text: `t${index}`, kind: 'docs', jobId: `j${index}`, count: 1,
    }));
    expect(getPanelPageCount('pending', { overview: null, crew: null, logistics: null, pending: { items: many } })).toBe(3);
  });
});

describe('logistics labels', () => {
  it('translates procedures and vehicles', () => {
    expect(getProcedureLabel('load')).toEqual({ label: 'CARGA', tone: 'load' });
    expect(getProcedureLabel('unload')).toEqual({ label: 'DESCARGA', tone: 'unload' });
    expect(getVehicleLabel('trailer')).toBe('Tráiler');
    expect(getVehicleLabel('9m')).toBe('Camión 9 m');
    expect(getVehicleLabel(null)).toBe('Transporte');
  });
});
