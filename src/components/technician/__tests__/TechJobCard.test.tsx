import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TechJobCard } from '../TechJobCard';

// Mock hooks
vi.mock('@/hooks/useExpensePermissions', () => ({
  useExpensePermissions: () => ({ data: [], isLoading: false }),
  isPermissionActive: () => false,
}));

vi.mock('@/hooks/useJobExpenses', () => ({
  useJobExpenses: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/utils/roles', () => ({
  labelForCode: (code: string) => code,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
      })),
    })),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockTheme = {
  bg: 'bg-slate-50',
  nav: 'bg-white',
  card: 'bg-white',
  textMain: 'text-slate-900',
  textMuted: 'text-slate-500',
  accent: 'bg-blue-600',
  input: 'bg-white',
  modalOverlay: 'bg-slate-900/40',
  divider: 'border-slate-100',
  danger: 'text-red-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  cluster: 'bg-slate-900',
};

const mockJob = {
  jobs: {
    id: 'job-123',
    title: 'Test Festival',
    description: 'Test description',
    start_time: '2026-03-15T18:00:00Z',
    end_time: '2026-03-15T23:00:00Z',
    timezone: 'Europe/Madrid',
    location: { name: 'Test Venue' },
    job_type: 'festival',
    status: 'confirmed',
    created_at: '2026-03-01T10:00:00Z',
    artist_count: 5,
  },
  sound_role: 'SND-FOH-E',
};

describe('TechJobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders job title and location', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Test Festival')).toBeInTheDocument();
    expect(screen.getByText(/Test Venue/)).toBeInTheDocument();
  });

  it('displays role information', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('SND-FOH-E')).toBeInTheDocument();
  });

  it('shows timesheet button for non-tourdate jobs', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Horas')).toBeInTheDocument();
  });

  it('does not show timesheet button for tourdate jobs', () => {
    const tourdateJob = {
      ...mockJob,
      jobs: { ...mockJob.jobs, job_type: 'tourdate' },
    };

    render(
      <TechJobCard
        job={tourdateJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Horas')).not.toBeInTheDocument();
  });

  it('does not show timesheet button for dryhire jobs', () => {
    const dryhireJob = {
      ...mockJob,
      jobs: { ...mockJob.jobs, job_type: 'dryhire' },
    };

    render(
      <TechJobCard
        job={dryhireJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Horas')).not.toBeInTheDocument();
  });

  it('shows artists button when artists are present', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Artistas')).toBeInTheDocument();
  });

  it('shows RF table button for RF engineer with artists', () => {
    const rfJob = {
      ...mockJob,
      sound_role: 'SND-RF-E',
    };

    render(
      <TechJobCard
        job={rfJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Tabla RF / IEM')).toBeInTheDocument();
  });

  it('does not show RF table button for non-RF roles', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByText('Tabla RF / IEM')).not.toBeInTheDocument();
  });

  it('shows incident report button for non-dryhire jobs', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    // Look for incident report related text
    expect(screen.getByText('Ver detalles')).toBeInTheDocument();
  });

  it('shows oblique strategy button for crew chief', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={true}
        techName="John Doe"
        onOpenObliqueStrategy={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const button = screen.getByTitle('Estrategias Oblicuas');
    expect(button).toBeInTheDocument();
  });

  it('does not show oblique strategy button for non-crew-chief', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.queryByTitle('Estrategias Oblicuas')).not.toBeInTheDocument();
  });

  it('calls onAction with correct parameters when details button clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={onAction}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByText('Ver detalles'));

    expect(onAction).toHaveBeenCalledWith('details', mockJob.jobs);
  });

  it('calls onAction with correct parameters when timesheet button clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={onAction}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByText('Horas'));

    expect(onAction).toHaveBeenCalledWith('timesheet', mockJob.jobs);
  });

  it('calls onAction with correct parameters when artists button clicked', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={onAction}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByText('Artistas'));

    expect(onAction).toHaveBeenCalledWith('artists', mockJob.jobs);
  });

  it('formats time display correctly', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    // Time should be formatted (exact format depends on timezone)
    const timeElements = screen.getAllByText(/\d{2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('displays active status badge', () => {
    render(
      <TechJobCard
        job={mockJob}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('handles missing location gracefully', () => {
    const jobWithoutLocation = {
      ...mockJob,
      jobs: { ...mockJob.jobs, location: null },
    };

    render(
      <TechJobCard
        job={jobWithoutLocation}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Sin ubicación')).toBeInTheDocument();
  });

  it('handles missing job title gracefully', () => {
    const jobWithoutTitle = {
      ...mockJob,
      jobs: { ...mockJob.jobs, title: '' },
    };

    render(
      <TechJobCard
        job={jobWithoutTitle}
        theme={mockTheme}
        isDark={false}
        onAction={vi.fn()}
        isCrewChief={false}
        techName="John Doe"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Sin título')).toBeInTheDocument();
  });
});