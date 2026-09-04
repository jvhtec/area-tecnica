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
    expect(getJobSetupTaskAction(task('pesos:sound', 'technical', 'sound'), 'job a')).toMatchObject({
      kind: 'route', href: '/sound/pesos?jobId=job+a',
    });
    expect(getJobSetupTaskAction(task('consumos:lights', 'technical', 'lights'), 'job-1')).toMatchObject({
      kind: 'route', href: '/lights-consumos-tool?jobId=job-1',
    });
    expect(getJobSetupTaskAction(task('technical_report:video', 'technical', 'video'), 'job-1')).toMatchObject({
      kind: 'route', href: '/video-memoria-tecnica?jobId=job-1',
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
    expect(getJobSetupTaskAction(task('flex_folders', 'resources'), 'job/1')).toMatchObject({
      kind: 'project', href: '/project-management?setupJobId=job%2F1',
    });
  });
});
