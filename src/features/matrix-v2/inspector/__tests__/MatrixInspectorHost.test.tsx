// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runner: { run: vi.fn(), releaseAll: vi.fn(), loadState: vi.fn() },
  getState: vi.fn(),
  toast: Object.assign(vi.fn(), { info: vi.fn(), error: vi.fn(), success: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: mocks.toast }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/features/matrix-v2/useMatrixCommandRunner', () => ({ useMatrixCommandRunner: () => mocks.runner }));
vi.mock('@/features/matrix-v2/focus/useMatrixJobFocus', () => ({
  useMatrixJobFocus: () => ({ focus: null, applyOrder: <T,>(rows: T[]) => rows }),
}));
vi.mock('@/features/assignments/commands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/assignments/commands')>()),
  getAssignmentCommandState: mocks.getState,
}));

import { MatrixInspectorHost } from '@/features/matrix-v2/inspector/MatrixInspectorHost';
import { useMatrixV2Config } from '@/features/matrix-v2/useMatrixV2Config';
import type { InspectorEnvironment, InspectorTechnician } from '@/features/matrix-v2/inspector/environment';
import type { MatrixV2ViewConfig } from '@/features/matrix-v2/viewConfig';
import type { MatrixRunOutcome } from '@/features/matrix-v2/types';
import { TECH_1, TECH_2, makeJob, makeMatrixRow, makeResult, makeRow, makeState } from '@/features/matrix-v2/__tests__/fixtures';

const date = new Date('2026-10-14T12:00:00+02:00');
const technicians: InspectorTechnician[] = [
  { id: TECH_1, first_name: 'Marta', last_name: 'Ibáñez', nickname: null, department: 'sound', skills: [] },
  { id: TECH_2, first_name: 'Ana', last_name: 'Villar', nickname: null, department: 'sound', skills: [] },
];

function setup(mobile: boolean) {
  let complete!: (outcome: MatrixRunOutcome) => void;
  const pending = new Promise<MatrixRunOutcome>((resolve) => { complete = resolve; });
  mocks.runner.run.mockReturnValue(pending);
  mocks.getState.mockResolvedValue(makeState({ exists: true, assignment: makeRow(), dates: ['2026-10-13', '2026-10-14'] }));
  const job = makeJob('job-a');
  const getAssignmentForCell = (technicianId: string) => makeMatrixRow({ technician_id: technicianId, date: '2026-10-14', job });
  const roleSlotsByJob = new Map();
  let current!: MatrixV2ViewConfig;
  function Harness() {
    const { v2Config } = useMatrixV2Config({
      enabled: true, ready: true, jobs: [job], technicians, dates: [date], baseOrderedTechnicians: technicians,
      allAssignments: [], getAssignmentForCell, getAvailabilityForCell: () => undefined,
      isManagementUser: true, roleSlotsByJob, declinedJobsByTech: new Map(), focusJobId: null, focusStatus: 'invited',
    });
    current = v2Config!;
    const env: InspectorEnvironment = {
      runner: current.runner, getTechnician: (id) => technicians.find((technician) => technician.id === id),
      getJob: () => job, getJobsForDate: () => [job], getAssignmentForCell, getAvailabilityForCell: () => undefined,
      roleSlotsByJob, lastRoleByTechnician: current.lastRoleByTechnician, declinedJobIds: () => new Set(),
      isFridge: () => false, staffingByDate: () => null, profileNames: new Map(), canAssign: true, canMarkUnavailable: true,
      staffing: { send: vi.fn(), cancel: vi.fn(), channel: 'email', setChannel: vi.fn(), department: 'sound' },
    };
    return <>
      {technicians.map((technician) => <div key={technician.id} data-matrix-cell
        data-technician-id={technician.id} data-date-key="2026-10-14" />)}
      <MatrixInspectorHost env={env} target={current.inspectorTarget} onClose={current.closeInspector} mobile={mobile} />
    </>;
  }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Harness />
  </QueryClientProvider>);
  const user = userEvent.setup();
  const open = (id: string) => act(() => current.openInspector(id, date, null));
  const submit = async () => {
    const button = await screen.findByRole('button', { name: 'Confirmar' });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(mocks.runner.run).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: 'confirm', technicianId: TECH_1 }));
  };
  const finish = () => act(async () => {
    complete({ ok: true, noop: false, result: makeResult(), undo: null });
    await pending;
  });
  return { user, open, submit, finish, config: () => current };
}

beforeEach(() => vi.clearAllMocks());

it('carries the optional staffing draft through opening without affecting ordinary opens', () => {
  const { config, open } = setup(true);
  const staffingDraft = { jobId: 'job-a', phase: 'offer' as const, days: ['2026-10-14'], channel: 'whatsapp' as const, department: null, message: 'Carga por B' };
  act(() => config().openInspector(TECH_1, date, null, undefined, staffingDraft));
  expect(config().inspectorTarget).toMatchObject({ staffingDraft });
  open(TECH_2);
  expect(config().inspectorTarget?.staffingDraft).toBeUndefined();
});

describe.each([['sheet', true], ['popover', false]] as const)('MatrixInspectorHost %s close ownership', (_surface, mobile) => {
  it('keeps B open when a delayed operation from A completes', async () => {
    const { open, submit, finish, config } = setup(mobile);
    open(TECH_1);
    await submit();
    open(TECH_2);
    const targetB = config().inspectorTarget;
    await finish();
    expect(config().inspectorTarget).toBe(targetB);
    expect(screen.getByRole('heading', { name: 'Ana Villar' })).toBeInTheDocument();
  });

  it('closes the same target when its operation completes', async () => {
    const { open, submit, finish, config } = setup(mobile);
    open(TECH_1);
    await submit();
    await finish();
    expect(config().inspectorTarget).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Marta Ibáñez' })).not.toBeInTheDocument();
  });

  it('keeps a new generation open when the same pair is reopened', async () => {
    const { open, submit, finish, config } = setup(mobile);
    open(TECH_1);
    await submit();
    const original = config().inspectorTarget;
    open(TECH_1);
    const reopened = config().inspectorTarget;
    expect(reopened).not.toBe(original);
    await finish();
    expect(config().inspectorTarget).toBe(reopened);
    expect(screen.getByRole('heading', { name: 'Marta Ibáñez' })).toBeInTheDocument();
  });

  it('still closes the current inspector from the header after switching targets', async () => {
    const { user, open, config } = setup(mobile);
    open(TECH_1);
    open(TECH_2);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(config().inspectorTarget).toBeNull();
  });
});
