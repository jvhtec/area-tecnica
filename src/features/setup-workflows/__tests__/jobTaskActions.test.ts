import { describe, expect, it } from 'vitest';
import { getJobSetupTaskAction } from '../jobTaskActions';

const task = (taskKey: string, category: string, department?: string) => ({
  task_key: taskKey,
  category,
  metadata: department ? { department } : {},
});

describe('getJobSetupTaskAction', () => {
  it('opens canonical editors for basic data and personnel', () => {
    expect(getJobSetupTaskAction(task('basic_information', 'basic'), 'job-1')).toEqual({
      kind: 'dialog', dialog: 'edit', label: 'Editar trabajo',
    });
    expect(getJobSetupTaskAction(task('personnel:lights', 'personnel', 'lights'), 'job-1')).toMatchObject({
      kind: 'dialog', dialog: 'requirements', department: 'lights',
    });
  });

  it('routes department calculations to the existing job-aware tools', () => {
    const actions = [
      getJobSetupTaskAction(task('pesos:sound', 'technical', 'sound'), 'job-1'),
      getJobSetupTaskAction(task('consumos:lights', 'technical', 'lights'), 'job-1'),
      getJobSetupTaskAction(task('technical_report:video', 'technical', 'video'), 'job-1'),
    ];
    expect(actions.map(action => action.kind === 'route' ? new URL(action.href, 'https://app.test').pathname : null))
      .toEqual(['/sound/pesos', '/lights-consumos-tool', '/video-memoria-tecnica']);
    actions.forEach(action => {
      expect(action.kind).toBe('route');
      if (action.kind === 'route') {
        const url = new URL(action.href, 'https://app.test');
        expect(url.searchParams.get('jobId')).toBe('job-1');
        expect(url.searchParams.get('setupReturnTo')).toBe('/jobs/job-1/setup');
      }
    });
  });

  it('uses the existing task manager and Estructura actions where appropriate', () => {
    expect(getJobSetupTaskAction(task('prediction:video', 'technical', 'video'), 'job-1')).toMatchObject({
      kind: 'dialog', dialog: 'tasks', department: 'video',
    });
    expect(getJobSetupTaskAction(task('motors:estructura', 'technical', 'estructura'), 'job-1')).toMatchObject({
      kind: 'estructura', tool: 'motors',
    });
    expect(getJobSetupTaskAction(task('motor_certificate:estructura', 'technical', 'estructura'), 'job-1')).toMatchObject({
      kind: 'estructura', tool: 'certificate',
    });
  });

  it('returns operators to the real project card for Flex provisioning', () => {
    const action = getJobSetupTaskAction(task('flex_folders', 'resources'), 'job-1');
    expect(action.kind).toBe('project');
    if (action.kind !== 'project') return;
    const url = new URL(action.href, 'https://app.test');
    expect(url.pathname).toBe('/project-management');
    expect(url.searchParams.get('setupJobId')).toBe('job-1');
    expect(url.searchParams.get('setupReturnTo')).toBe('/jobs/job-1/setup');
  });
});
