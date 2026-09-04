// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { SetupWorkflowError } from '../errors';
import { setupWorkflowKeys, useCreateSetupWorkflow } from '../hooks';

const mocks = vi.hoisted(() => ({ createWorkflow: vi.fn(), toast: vi.fn() }));
vi.mock('../service', () => ({ createWorkflow: mocks.createWorkflow }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

it.each([
  [new SetupWorkflowError('duplicate_workflow', 'Ya existe una preparación activa.'), 'Ya existe una preparación activa.'],
  [new Error('Network transport failed'), 'No se pudo guardar o cargar la preparación. Inténtalo de nuevo.'],
])('keeps errors in Spanish and invalidates potentially committed data: %s', async (error, description) => {
  mocks.toast.mockClear();
  mocks.createWorkflow.mockRejectedValue(error);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const keys = [
    setupWorkflowKeys.detail('workflow-1'), setupWorkflowKeys.tasks('workflow-1'),
    setupWorkflowKeys.entity('job', 'job-1'),
  ];
  keys.forEach(key => client.setQueryData(key, {}));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, unmount } = renderHook(() => useCreateSetupWorkflow(), { wrapper });
  await act(async () => {
    await expect(result.current.mutateAsync({ workflowType: 'job', entityId: 'job-1', departments: [] })).rejects.toBe(error);
  });
  expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ description, variant: 'destructive' }));
  keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  unmount();
  client.clear();
});
