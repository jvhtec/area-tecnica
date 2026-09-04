import { describe, expect, it } from 'vitest';
import { getNextStep, getPreviousStep, getWorkflowDefinition, getWorkflowSteps } from '../definitions';
import { generateWorkflowTasks } from '../taskGeneration';
import { reconcileWorkflowTasks } from '../reconciliation';
import { calculateWorkflowProgress } from '../progress';
import { assertTaskTransition, assertWorkflowTransition, canTransitionTaskStatus, canTransitionWorkflowStatus } from '../transitions';
import type { SetupDepartment, TaskStatus, WorkflowStatus } from '../types';
import { persistTasks, taskFixture } from './fixtures';

describe('workflow definitions', () => {
  it('defines every workflow sequence centrally', () => {
    expect(getWorkflowSteps('job')).toEqual(['basic', 'departments', 'personnel', 'technical', 'resources', 'review']);
    expect(getWorkflowSteps('tour')).toEqual(['basic', 'departments', 'personnel', 'packages', 'dates', 'resources', 'review']);
    expect(getWorkflowSteps('tour_date')).toEqual(['defaults', 'overrides', 'resources', 'review']);
  });
  it('handles boundaries and rejects unknown types/steps (including object prototype names)', () => {
    expect(getNextStep('job', 'basic')).toBe('departments');
    expect(getPreviousStep('job', 'departments')).toBe('basic');
    expect(getNextStep('job', 'review')).toBeNull();
    expect(getPreviousStep('tour_date', 'defaults')).toBeNull();
    expect(() => getWorkflowDefinition('other')).toThrow(/desconocido/);
    expect(() => getWorkflowDefinition('toString')).toThrow(/desconocido/);
    expect(() => getNextStep('job', 'defaults')).toThrow(/Paso no válido/);
  });
});

describe('task generation', () => {
  it('uses the existing sound document vocabulary plus setup checks', () => {
    const keys = generateWorkflowTasks({ workflowType: 'job', departments: ['sound'] }).map(task => task.task_key);
    expect(keys).toEqual(['basic_information', 'departments', 'personnel:sound', 'quotation:sound',
      'rigging_plot:sound', 'prediction:sound', 'technical_report:sound', 'pesos:sound', 'consumos:sound', 'pull_sheet:sound', 'flex_folders', 'review']);
  });
  it('merges departments with stable keys/order and deduplicates global tasks', () => {
    const a = generateWorkflowTasks({ workflowType: 'job', departments: ['sound', 'estructura', 'sound'] });
    const b = generateWorkflowTasks({ workflowType: 'job', departments: ['estructura', 'sound'] });
    expect(a).toEqual(b);
    expect(a.filter(task => task.task_key === 'flex_folders')).toHaveLength(1);
    expect(a.map(task => task.task_key)).toContain('motor_certificate:estructura');
    expect(new Set(a.map(task => task.task_key)).size).toBe(a.length);
  });
  it('supports all setup departments and type-specific base tasks', () => {
    const departments: SetupDepartment[] = ['sound', 'lights', 'video', 'production', 'personnel', 'estructura'];
    expect(generateWorkflowTasks({ workflowType: 'tour', departments }).map(task => task.task_key)).toEqual(expect.arrayContaining(['packages', 'dates', 'personnel:personnel']));
    expect(generateWorkflowTasks({ workflowType: 'tour_date', departments: [] }).map(task => task.task_key)).toEqual(['defaults', 'overrides', 'review']);
    expect(() => generateWorkflowTasks({ workflowType: 'job', departments: ['toString' as SetupDepartment] })).toThrow(/no admitido/);
  });
});

describe('task reconciliation', () => {
  const initial = generateWorkflowTasks({ workflowType: 'job', departments: ['sound'] });
  it('adds new requirements while preserving statuses and completion evidence', () => {
    const existing = persistTasks(initial).map(task => taskFixture({
      ...task, status: 'completed', completed_by: 'technician', completed_at: '2026-09-04T09:00:00Z',
      metadata: { note: 'Checked against canonical record' },
    }));
    const desired = generateWorkflowTasks({ workflowType: 'job', departments: ['sound', 'estructura'] });
    const result = reconcileWorkflowTasks(existing, desired);
    expect(result.create.map(task => task.task_key)).toContain('motors:estructura');
    expect(result.retain.every(task => task.status === 'completed' && task.completed_by === 'technician')).toBe(true);
    expect(result.retain[0].metadata.note).toBe('Checked against canonical record');
    const persisted = [...result.retain, ...persistTasks(result.create)];
    expect(reconcileWorkflowTasks(persisted, desired)).toEqual({ create: [], retain: persisted });
  });
  it.each<TaskStatus>(['pending', 'completed', 'skipped', 'blocked'])('retains %s history through removal and reintroduction', status => {
    const existing = persistTasks(initial).map(task => ({ ...task, status }));
    const removed = reconcileWorkflowTasks(existing, generateWorkflowTasks({ workflowType: 'job', departments: [] }));
    const sound = removed.retain.find(task => task.task_key === 'pesos:sound')!;
    expect(sound).toMatchObject({ applicable: false, status });
    const restored = reconcileWorkflowTasks(removed.retain, initial);
    expect(restored.create).toEqual([]);
    expect(restored.retain.find(task => task.task_key === 'pesos:sound')).toMatchObject({ applicable: true, status });
  });
  it('rejects colliding definitions rather than silently overwriting them', () => {
    expect(() => reconcileWorkflowTasks([], [initial[0], initial[0]])).toThrow(/únicas/);
  });
});

describe('status machines', () => {
  const statuses: WorkflowStatus[] = ['draft', 'in_progress', 'review', 'complete', 'cancelled'];
  const legal = new Set(['draft:in_progress', 'draft:cancelled', 'in_progress:review', 'in_progress:complete',
    'in_progress:cancelled', 'review:in_progress', 'review:complete', 'review:cancelled']);
  for (const from of statuses) for (const to of statuses) {
    it(`checks workflow transition ${from} → ${to}`, () => {
      expect(canTransitionWorkflowStatus(from, to)).toBe(legal.has(`${from}:${to}`));
      if (legal.has(`${from}:${to}`)) expect(() => assertWorkflowTransition(from, to)).not.toThrow();
      else expect(() => assertWorkflowTransition(from, to)).toThrow(/no válido/);
    });
  }
  it('requires reopening completed/skipped tasks before another outcome', () => {
    expect(canTransitionTaskStatus('completed', 'pending')).toBe(true);
    expect(canTransitionTaskStatus('skipped', 'pending')).toBe(true);
    expect(canTransitionTaskStatus('blocked', 'completed')).toBe(true);
    expect(() => assertTaskTransition('completed', 'skipped')).toThrow(/no válido/);
    expect(() => assertTaskTransition('pending', 'pending')).toThrow(/no válido/);
  });
});

describe('progress and completion policy', () => {
  it('separates completion policy from optional progress', () => {
    expect(calculateWorkflowProgress([taskFixture({ status: 'completed' }), taskFixture({ required: false })]))
      .toMatchObject({ percentage: 50, isAdministrativelyComplete: true });
  });
  it('resolves optional skips but never required skips', () => {
    expect(calculateWorkflowProgress([taskFixture({ status: 'completed' }), taskFixture({ status: 'skipped', required: false })]))
      .toMatchObject({ totalTasks: 2, completedTasks: 1, requiredTasks: 1, requiredCompletedTasks: 1, percentage: 100, isAdministrativelyComplete: true });
    expect(calculateWorkflowProgress([taskFixture({ status: 'skipped' })]))
      .toMatchObject({ percentage: 0, isAdministrativelyComplete: false });
  });
  it('blocks completion even for optional blockers and ignores retired tasks', () => {
    expect(calculateWorkflowProgress([taskFixture({ status: 'completed' }), taskFixture({ required: false, status: 'blocked' })]))
      .toMatchObject({ blockedTasks: 1, hasBlockers: true, isAdministrativelyComplete: false });
    expect(calculateWorkflowProgress([taskFixture({ status: 'completed' }), taskFixture({ status: 'blocked', applicable: false })]))
      .toMatchObject({ totalTasks: 1, blockedTasks: 0, hasBlockers: false, percentage: 100, isAdministrativelyComplete: true });
  });
  it('does not classify an empty workflow as complete', () => {
    expect(calculateWorkflowProgress([])).toMatchObject({ totalTasks: 0, percentage: 0, isAdministrativelyComplete: false });
  });
});
