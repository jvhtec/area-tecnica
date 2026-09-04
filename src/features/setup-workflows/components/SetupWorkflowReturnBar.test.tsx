// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SetupWorkflowReturnBar } from './SetupWorkflowReturnBar';

function CurrentPath() {
  const location = useLocation();
  return <output>{location.pathname}</output>;
}

describe('SetupWorkflowReturnBar', () => {
  it('returns routed tools to the originating Job setup hub', async () => {
    render(
      <MemoryRouter initialEntries={['/sound/pesos?jobId=job-1&setupReturnTo=%2Fjobs%2Fjob-1%2Fsetup']}>
        <SetupWorkflowReturnBar />
        <Routes><Route path="*" element={<CurrentPath />} /></Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /volver a preparación guiada/i }));
    expect(screen.getByText('/jobs/job-1/setup')).toBeInTheDocument();
  });

  it('stays hidden for ordinary tool navigation', () => {
    render(<MemoryRouter initialEntries={['/sound/pesos']}><SetupWorkflowReturnBar /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /volver a preparación guiada/i })).not.toBeInTheDocument();
  });
});
