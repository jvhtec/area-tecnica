// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import JobSetup from '../JobSetup';
import type { SetupWorkflow, SetupWorkflowTask } from '@/features/setup-workflows/types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetchWorkflow: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  refetchTasks: vi.fn(),
  tasksError: null as Error | null,
  workflow: null as SetupWorkflow | null,
  latestWorkflow: null as SetupWorkflow | null,
}));

const job = {
  id: 'job-1', title: 'Gala', job_type: 'single', created_at: '2026-09-04T09:00:00Z',
  start_time: '2026-09-10T08:00:00Z', end_time: '2026-09-10T22:00:00Z',
  job_departments: [{ department: 'sound' }],
};

const task: SetupWorkflowTask = {
  id: 'task-1', workflow_id: 'workflow-1', task_key: 'pesos:sound', category: 'technical',
  label: 'Pesos · Sonido', status: 'pending', required: true, responsible_role: 'technical',
  metadata: { department: 'sound' }, applicable: true, completed_by: null, completed_at: null,
  created_at: '2026-09-04T09:00:00Z', updated_at: '2026-09-04T09:00:00Z',
};

vi.mock('@/features/setup-workflows/jobContext', async () => {
  const actual = await vi.importActual<typeof import('@/features/setup-workflows/jobContext')>('@/features/setup-workflows/jobContext');
  return { ...actual, useSetupJob: () => ({ data: job, isLoading: false, isError: false, refetch: vi.fn() }) };
});

vi.mock('@/features/setup-workflows/hooks', () => ({
  useCreateSetupWorkflow: () => ({ mutateAsync: mocks.create, isPending: false }),
  useSetupWorkflowForEntity: () => ({ data: mocks.workflow, isLoading: false, refetch: mocks.refetchWorkflow }),
  useLatestSetupWorkflowForEntity: () => ({ data: mocks.latestWorkflow, isLoading: false, refetch: vi.fn(), isError: false }),
  useSetupWorkflowTasks: () => ({
    data: mocks.workflow || mocks.latestWorkflow ? [task] : [], isLoading: false,
    isError: Boolean(mocks.tasksError), error: mocks.tasksError, refetch: mocks.refetchTasks,
  }),
  useSetupWorkflowStatusMutation: () => ({ mutateAsync: mocks.updateStatus, isPending: false }),
  useUpdateSetupWorkflow: () => ({ mutateAsync: mocks.update, mutate: mocks.update, isPending: false }),
}));

vi.mock('@/hooks/useOptimizedAuth', () => ({ useOptimizedAuth: () => ({ userRole: 'management' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/jobs/EditJobDialog', () => ({ EditJobDialog: (): null => null }));
vi.mock('@/components/jobs/JobDetailsDialog', () => ({ JobDetailsDialog: (): null => null }));
vi.mock('@/components/jobs/JobRequirementsEditor', () => ({ JobRequirementsEditor: (): null => null }));
vi.mock('@/components/tasks/TaskManagerDialog', () => ({ TaskManagerDialog: (): null => null }));
vi.mock('@/components/jobs/cards/job-card-actions/MotorCertificateAction', () => ({ MotorCertificateAction: (): null => null }));
vi.mock('@/components/jobs/cards/job-card-actions/PrepareMotorsAction', () => ({ PrepareMotorsAction: (): null => null }));

function Location() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}

const renderPage = () => render(
  <MemoryRouter initialEntries={['/jobs/job-1/setup']}>
    <Routes>
      <Route path="/jobs/:jobId/setup" element={<JobSetup />} />
      <Route path="*" element={<Location />} />
    </Routes>
  </MemoryRouter>,
);

describe('JobSetup', () => {
  beforeEach(() => {
    mocks.create.mockReset();
    mocks.refetchWorkflow.mockReset().mockResolvedValue(undefined);
    mocks.update.mockReset().mockResolvedValue(undefined);
    mocks.updateStatus.mockReset().mockResolvedValue(undefined);
    mocks.refetchTasks.mockReset().mockResolvedValue(undefined);
    mocks.tasksError = null;
    mocks.latestWorkflow = null;
    mocks.workflow = {
      id: 'workflow-1', type: 'job', entity_id: 'job-1', job_id: 'job-1', tour_id: null,
      tour_date_id: null, status: 'in_progress', current_step: 'basic', assigned_to: null,
      created_by: 'user-1', state: {}, created_at: '2026-09-04T09:00:00Z',
      updated_at: '2026-09-04T09:00:00Z', completed_at: null,
    };
  });

  it('persists the current step before navigating to the real calculation tool', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /abrir herramienta/i }));

    expect(mocks.update).toHaveBeenCalledWith({ action: 'step', step: 'technical' });
    expect(await screen.findByText('/sound/pesos?jobId=job-1&setupReturnTo=%2Fjobs%2Fjob-1%2Fsetup')).toBeInTheDocument();
  });

  it('persists explicit task completion', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /^completar$/i }));
    expect(mocks.update).toHaveBeenCalledWith({ action: 'task_status', taskKey: 'pesos:sound', status: 'completed' });
  });

  it('creates and starts a workflow for an existing job without one', async () => {
    mocks.workflow = null;
    mocks.create.mockResolvedValue({ id: 'workflow-new' });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /iniciar preparación/i }));

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ workflowType: 'job', entityId: 'job-1', departments: ['sound'] }));
    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalledWith({ workflowId: 'workflow-new', status: 'in_progress' }));
    expect(mocks.refetchWorkflow).toHaveBeenCalled();
  });

  it('shows task loading failures with a retry action', async () => {
    mocks.tasksError = new Error('Sin conexión');
    renderPage();

    expect(screen.getByText('No se pudieron cargar las tareas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(mocks.refetchTasks).toHaveBeenCalledOnce();
  });

  it('keeps a completed workflow visible and offers a new preparation', () => {
    mocks.workflow = null;
    mocks.latestWorkflow = {
      id: 'workflow-complete', type: 'job', entity_id: 'job-1', job_id: 'job-1', tour_id: null,
      tour_date_id: null, status: 'complete', current_step: 'review', assigned_to: null,
      created_by: 'user-1', state: {}, created_at: '2026-09-04T09:00:00Z',
      updated_at: '2026-09-04T10:00:00Z', completed_at: '2026-09-04T10:00:00Z',
    };

    renderPage();

    expect(screen.getByRole('button', { name: /iniciar una nueva preparación/i })).toBeInTheDocument();
    expect(screen.getByText('Cerrar preparación')).toBeInTheDocument();
  });
});
