import { describe, expect, it } from 'vitest';
import type { GlobalTask } from '@/hooks/useGlobalTasks';
import { filterGlobalTasks, getGlobalTaskStats, getGlobalTaskTypeOptions } from './globalTaskSelectors';

const tasks = [
  { id: '1', task_type: 'Carga', status: 'not_started', assigned_to: null },
  { id: '2', task_type: 'Prueba', status: 'in_progress', assigned_to: 'tech-1' },
  { id: '3', task_type: 'Carga', status: 'completed', assigned_to: 'tech-2' },
] as GlobalTask[];

describe('global task selectors', () => {
  it('combines active/status and assignment filters', () => {
    expect(filterGlobalTasks(tasks, 'active', 'all').map((task) => task.id)).toEqual(['1', '2']);
    expect(filterGlobalTasks(tasks, 'all', 'unassigned').map((task) => task.id)).toEqual(['1']);
    expect(filterGlobalTasks(tasks, 'all', 'tech-2').map((task) => task.id)).toEqual(['3']);
  });

  it('derives sorted types and status totals', () => {
    expect(getGlobalTaskTypeOptions(tasks)).toEqual(['Carga', 'Prueba']);
    expect(getGlobalTaskStats(tasks)).toEqual({
      total: 3,
      notStarted: 1,
      inProgress: 1,
      completed: 1,
    });
  });
});
