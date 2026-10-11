import type { AssignmentCommandResult, AssignmentCommandRow, AssignmentCommandState } from '@/features/assignments/commands';
import type { MatrixJob, MatrixTimesheetAssignment } from '@/hooks/useOptimizedMatrixData';
import type { MatrixTechnicianRef } from '@/features/matrix-v2/types';

export const JOB_A = 'job-a';
export const JOB_B = 'job-b';
export const TECH_1 = 'tech-1';
export const TECH_2 = 'tech-2';

export const makeJob = (id: string, overrides: Partial<MatrixJob> = {}): MatrixJob => ({
  id,
  title: `Trabajo ${id}`,
  start_time: '2026-10-13T08:00:00+02:00',
  end_time: '2026-10-14T20:00:00+02:00',
  color: '#2563eb',
  status: 'Confirmado',
  job_type: 'single',
  ...overrides,
});

export const makeTechnician = (id: string, overrides: Partial<MatrixTechnicianRef> = {}): MatrixTechnicianRef => ({
  id,
  first_name: 'Marta',
  last_name: 'Ibáñez',
  nickname: null,
  department: 'sound',
  skills: [],
  ...overrides,
});

export const makeRow = (overrides: Partial<AssignmentCommandRow> = {}): AssignmentCommandRow => ({
  id: 'assignment-1',
  status: 'invited',
  sound_role: 'SND-FOH-E',
  lights_role: null,
  video_role: null,
  production_role: null,
  single_day: false,
  assignment_date: null,
  assignment_source: 'direct',
  ...overrides,
});

export const makeState = (overrides: Partial<AssignmentCommandState> = {}): AssignmentCommandState => ({
  exists: false,
  assignment: null,
  dates: [],
  state_token: 'token-0',
  ...overrides,
});

export const makeResult = (overrides: Partial<AssignmentCommandResult> = {}): AssignmentCommandResult => ({
  ok: true,
  outcome: 'committed',
  command_id: 'command-1',
  job_id: JOB_A,
  technician_id: TECH_1,
  state_token: 'token-1',
  replayed: false,
  assignment: makeRow(),
  dates: ['2026-10-13', '2026-10-14'],
  side_effects: [
    { kind: 'flex', action: 'add', job_id: JOB_A, department: 'sound', status: 'pending', effect_id: 'command-1:0' },
    { kind: 'notification', action: 'job.assignment.direct', job_id: JOB_A, status: 'pending', effect_id: 'command-1:1' },
  ],
  warnings: [],
  ...overrides,
});

export const makeMatrixRow = (overrides: Partial<MatrixTimesheetAssignment> = {}): MatrixTimesheetAssignment => ({
  job_id: JOB_A,
  technician_id: TECH_1,
  date: '2026-10-13',
  job: makeJob(JOB_A),
  status: 'invited',
  assigned_at: null,
  sound_role: 'SND-FOH-E',
  ...overrides,
});
