import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SetupWorkflowProgress } from './SetupWorkflowProgress';
import { taskFixture, workflowFixture } from '../__tests__/fixtures';

describe('SetupWorkflowProgress', () => {
  it('renders Spanish statuses, required skips and accessible progress', () => {
    render(<SetupWorkflowProgress workflow={workflowFixture} tasks={[
      taskFixture({ status: 'completed' }),
      taskFixture({ task_key: 'pesos:sound', label: 'Pesos', status: 'blocked' }),
      taskFixture({ task_key: 'review', label: 'Revisión', status: 'skipped' }),
      taskFixture({ task_key: 'old', label: 'Retired task', applicable: false }),
    ]} />);
    expect(screen.getByText('Preparación del trabajo')).toBeInTheDocument();
    expect(screen.getByText(/1\/3 completadas/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText(/1 tarea bloqueada/)).toBeInTheDocument();
    expect(screen.getByText(/Obligatoria sin resolver/)).toBeInTheDocument();
    expect(screen.queryByText('Retired task')).not.toBeInTheDocument();
  });
  it('supports compact mode while keeping blockers visible', () => {
    render(<SetupWorkflowProgress compact workflow={workflowFixture} tasks={[taskFixture({ status: 'blocked' })]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/tarea bloqueada/)).toBeInTheDocument();
  });
});
