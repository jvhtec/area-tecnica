import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobCardNew } from '../JobCardNew';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('JobCardNew - Lights Requirements Display', () => {
  const mockJob = {
    id: 'job-1', title: 'Test Job', date: '2024-01-15',
    location_id: 'loc-1', tour_id: 'tour-1',
    job_departments: [{ id: 'dept-1', job_id: 'job-1', department: 'lights' as const }],
  };

  beforeEach(() => vi.clearAllMocks());

  it('should render lights requirements when department is lights and data is available', () => {
    const lightsRequirements = { ld: 2, programmers: 3, dimmer_techs: 1, floor_techs: 4 };
    render(<JobCardNew job={mockJob} index={0} department="lights" lightsRequirements={lightsRequirements} tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.getByText(/LD:/)).toBeInTheDocument();
    expect(screen.getByText(/Programmers:/)).toBeInTheDocument();
  });

  it('should display 0 for missing lights requirement fields', () => {
    const lightsRequirements = { ld: 2, programmers: undefined, dimmer_techs: null, floor_techs: 0 };
    render(<JobCardNew job={mockJob} index={0} department="lights" lightsRequirements={lightsRequirements} tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.getByText(/LD: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Programmers: 0/)).toBeInTheDocument();
  });

  it('should not render lights requirements when department is not lights', () => {
    const lightsRequirements = { ld: 2, programmers: 3, dimmer_techs: 1, floor_techs: 4 };
    render(<JobCardNew job={mockJob} index={0} department="sound" lightsRequirements={lightsRequirements} tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.queryByText(/LD:/)).not.toBeInTheDocument();
  });

  it('should not render when lightsRequirements is null or undefined', () => {
    render(<JobCardNew job={mockJob} index={0} department="lights" lightsRequirements={null} tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.queryByText(/LD:/)).not.toBeInTheDocument();
  });
});

describe('JobCardNew - Tasks Display', () => {
  const mockJob = {
    id: 'job-1', title: 'Test Job', date: '2024-01-15',
    location_id: 'loc-1', tour_id: 'tour-1',
    job_departments: [{ id: 'dept-1', job_id: 'job-1', department: 'sound' as const }],
  };

  beforeEach(() => vi.clearAllMocks());

  it('should render tasks section header', () => {
    render(<JobCardNew job={mockJob} index={0} department="sound" tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.getByText('Tasks')).toBeInTheDocument();
  });

  it('should display "No tasks available" when tasks array is empty', () => {
    render(<JobCardNew job={mockJob} index={0} department="sound" tasks={[]} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.getByText('No tasks available')).toBeInTheDocument();
  });

  it('should render all tasks with their titles and statuses', () => {
    const tasks = [
      { id: '1', title: 'Setup Equipment', status: 'completed' as const },
      { id: '2', title: 'Sound Check', status: 'in_progress' as const },
    ];
    render(<JobCardNew job={mockJob} index={0} department="sound" tasks={tasks} onJobClick={vi.fn()} onToggleExpand={vi.fn()} variant="card" />, { wrapper: createWrapper() });
    expect(screen.getByText('Setup Equipment')).toBeInTheDocument();
    expect(screen.getByText('Sound Check')).toBeInTheDocument();
  });
});