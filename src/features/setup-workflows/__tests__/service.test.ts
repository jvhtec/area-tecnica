import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workflowFixture, taskFixture } from './fixtures';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), result: vi.fn(), single: vi.fn() }));
vi.mock('../database', () => ({ workflowClient: { rpc: mocks.rpc, from: mocks.from } }));
import { blockTask, cancelWorkflow, completeTask, completeWorkflow, createWorkflow, getWorkflow, getWorkflowForEntity,
  resumeWorkflow, setCurrentStep, skipTask, syncGeneratedTasks, updateWorkflowState } from '../service';

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), maybeSingle: mocks.result, order: mocks.result };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
  mocks.result.mockResolvedValue({ data: workflowFixture, error: null });
  mocks.rpc.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: workflowFixture, error: null });
});

describe('workflow service', () => {
  it('creates workflow and generated tasks in a single atomic request', async () => {
    await createWorkflow({ workflowType: 'job', entityId: 'job-1', departments: ['sound'], state: { draft: 'saved' } });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith('mutate_setup_workflow', expect.objectContaining({
      p_action: 'create', p_payload: expect.objectContaining({
        type: 'job', entity_id: 'job-1', state: { draft: 'saved' },
        tasks: expect.arrayContaining([expect.objectContaining({ task_key: 'pesos:sound' })]),
      }),
    }));
  });
  it('reloads persisted state, step and task statuses on resume without writing', async () => {
    const saved = { ...workflowFixture, current_step: 'technical', state: { technical: { notes: 'resume me' } } };
    const tasks = [taskFixture({ status: 'blocked' })];
    mocks.result.mockResolvedValueOnce({ data: saved, error: null }).mockResolvedValueOnce({ data: tasks, error: null });
    expect(await resumeWorkflow('workflow-1')).toEqual({ workflow: saved, tasks });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('sends state patches without reading and replacing another session’s state', async () => {
    await updateWorkflowState('workflow-1', { resources: { note: 'pending' } });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('mutate_setup_workflow', {
      p_action: 'state', p_workflow_id: 'workflow-1', p_payload: { state: { resources: { note: 'pending' } } },
    });
  });
  it('validates steps against persisted workflow type', async () => {
    await expect(setCurrentStep('workflow-1', 'dates')).rejects.toMatchObject({ code: 'invalid_step' });
    expect(mocks.rpc).not.toHaveBeenCalled();
    await setCurrentStep('workflow-1', 'review');
    expect(mocks.rpc).toHaveBeenCalledWith('mutate_setup_workflow', expect.objectContaining({ p_action: 'step' }));
  });
  it('uses persisted type to sync definitions without writing task status', async () => {
    await syncGeneratedTasks('workflow-1', ['estructura']);
    const payload = mocks.rpc.mock.calls[0][1].p_payload;
    expect(payload.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ task_key: 'motors:estructura' })]));
    expect(payload.tasks.every((task: object) => !('status' in task))).toBe(true);
  });
  it('supports historical entities without workflows but reports missing workflow ids', async () => {
    mocks.result.mockResolvedValue({ data: null, error: null });
    expect(await getWorkflowForEntity('tour', 'old-tour')).toBeNull();
    await expect(getWorkflow('unknown')).rejects.toMatchObject({ code: 'missing_workflow' });
  });
  it.each(['duplicate_workflow', 'invalid_transition', 'invalid_task_transition', 'incomplete_workflow', 'missing_task', 'forbidden'])('preserves explicit %s server failures', async code => {
    mocks.single.mockResolvedValue({ data: null, error: { code: '22023', message: `${code}: rejected` } });
    await expect(completeWorkflow('workflow-1')).rejects.toMatchObject({ code });
  });
  it('does not swallow read or write persistence errors', async () => {
    mocks.result.mockResolvedValue({ data: null, error: { message: 'connection failed' } });
    await expect(getWorkflow('workflow-1')).rejects.toMatchObject({ code: 'persistence' });
    mocks.single.mockResolvedValue({ data: null, error: { message: 'connection failed' } });
    await expect(updateWorkflowState('workflow-1', {})).rejects.toMatchObject({ code: 'persistence' });
  });
  it('localizes server failures for toasts while retaining the original diagnostic cause', async () => {
    const error = { code: '23505', message: 'duplicate_workflow: an active workflow already exists' };
    mocks.single.mockResolvedValue({ data: null, error });
    await expect(createWorkflow({ workflowType: 'job', entityId: 'job-1', departments: [] })).rejects.toMatchObject({
      code: 'duplicate_workflow', message: 'Ya existe una preparación activa para este elemento.', cause: error,
    });
  });
  it('routes task and terminal helpers through the server transition gate', async () => {
    await completeTask('workflow-1', 'review');
    await skipTask('workflow-1', 'review');
    await blockTask('workflow-1', 'review');
    await cancelWorkflow('workflow-1');
    expect(mocks.rpc.mock.calls.map(call => call[1].p_payload.status)).toEqual(['completed', 'skipped', 'blocked', 'cancelled']);
  });
});
