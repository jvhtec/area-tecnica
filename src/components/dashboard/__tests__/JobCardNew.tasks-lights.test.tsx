import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JobCardNew } from '../JobCardNew';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } })
    }
  }
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  )
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

describe('JobCardNew - Tasks and Lights Requirements Rendering', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Tasks Display', () => {
    it('should render tasks section when tasks are available', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        end_date: '2024-01-16',
        status: 'active',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: 'Setup equipment', status: 'pending' },
          { id: 'task-2', title: 'Sound check', status: 'in_progress' },
          { id: 'task-3', title: 'Pack up', status: 'completed' }
        ]
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
        />
      );

      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Setup equipment')).toBeInTheDocument();
      expect(screen.getByText('Sound check')).toBeInTheDocument();
      expect(screen.getByText('Pack up')).toBeInTheDocument();
    });

    it('should show "No tasks available" message when tasks array is empty', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
        />
      );

      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('No tasks available')).toBeInTheDocument();
    });

    it('should render task status indicators with correct colors', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: 'Task 1', status: 'completed' },
          { id: 'task-2', title: 'Task 2', status: 'in_progress' },
          { id: 'task-3', title: 'Task 3', status: 'pending' }
        ]
      };

      const { container } = renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
        />
      );

      const statusIndicators = container.querySelectorAll('.rounded-full');
      
      // Check for completed (green), in_progress (yellow), pending (muted) indicators
      expect(statusIndicators[0]).toHaveClass('bg-green-500');
      expect(statusIndicators[1]).toHaveClass('bg-yellow-500');
      expect(statusIndicators[2]).toHaveClass('bg-muted-foreground');
    });

    it('should display task status badges with proper formatting', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: 'Task 1', status: 'in_progress' }
        ]
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
        />
      );

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveTextContent('in progress');
      expect(badge).toHaveAttribute('data-variant', 'secondary');
    });

    it('should handle tasks with undefined or null status gracefully', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: 'Task without status', status: null as any }
        ]
      };

      expect(() => {
        renderWithProviders(
          <JobCardNew
            job={mockJob as any}
            onClick={() => {}}
            selectedDepartment="audio"
          />
        );
      }).not.toThrow();
    });

    it('should truncate long task titles properly', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { 
            id: 'task-1', 
            title: 'This is a very long task title that should be truncated in the UI to prevent layout issues',
            status: 'pending' 
          }
        ]
      };

      const { container } = renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
        />
      );

      const taskTitle = container.querySelector('.truncate');
      expect(taskTitle).toBeInTheDocument();
      expect(taskTitle).toHaveClass('truncate');
    });
  });

  describe('Lights Requirements Display', () => {
    it('should render lights requirements when department is lights and requirements exist', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: 2,
          programmers: 3,
          dimmer_techs: 4,
          floor_techs: 5
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      expect(screen.getByText(/LD:/)).toBeInTheDocument();
      expect(screen.getByText(/LD: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Programmers: 3/)).toBeInTheDocument();
      expect(screen.getByText(/Dimmer Techs: 4/)).toBeInTheDocument();
      expect(screen.getByText(/Floor Techs: 5/)).toBeInTheDocument();
    });

    it('should display 0 for missing lights requirements fields', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: 2,
          // Missing other fields
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      expect(screen.getByText(/LD: 2/)).toBeInTheDocument();
      expect(screen.getByText(/Programmers: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Dimmer Techs: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Floor Techs: 0/)).toBeInTheDocument();
    });

    it('should not render lights requirements when department is not lights', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        lightsRequirements: {
          ld: 2,
          programmers: 3,
          dimmer_techs: 4,
          floor_techs: 5
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
          department="audio"
        />
      );

      expect(screen.queryByText(/LD:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Programmers:/)).not.toBeInTheDocument();
    });

    it('should not render lights requirements when requirements are null or undefined', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: null,
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      expect(screen.queryByText(/LD:/)).not.toBeInTheDocument();
    });

    it('should handle edge case with all zero values in lights requirements', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: 0,
          programmers: 0,
          dimmer_techs: 0,
          floor_techs: 0
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      expect(screen.getByText(/LD: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Programmers: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Dimmer Techs: 0/)).toBeInTheDocument();
      expect(screen.getByText(/Floor Techs: 0/)).toBeInTheDocument();
    });
  });

  describe('Combined Rendering', () => {
    it('should render both lights requirements and tasks together for lights department', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: 1,
          programmers: 2,
          dimmer_techs: 3,
          floor_techs: 4
        },
        tasks: [
          { id: 'task-1', title: 'Setup', status: 'pending' }
        ]
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      // Check lights requirements
      expect(screen.getByText(/LD: 1/)).toBeInTheDocument();
      
      // Check tasks
      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Setup')).toBeInTheDocument();
    });

    it('should render tasks only for non-lights departments', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: 'Audio task', status: 'pending' }
        ]
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="audio"
          department="audio"
        />
      );

      expect(screen.getByText('Tasks')).toBeInTheDocument();
      expect(screen.getByText('Audio task')).toBeInTheDocument();
      expect(screen.queryByText(/LD:/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string task titles', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['audio'],
        tasks: [
          { id: 'task-1', title: '', status: 'pending' }
        ]
      };

      expect(() => {
        renderWithProviders(
          <JobCardNew
            job={mockJob as any}
            onClick={() => {}}
            selectedDepartment="audio"
          />
        );
      }).not.toThrow();
    });

    it('should handle negative values in lights requirements gracefully', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: -1,
          programmers: -2,
          dimmer_techs: -3,
          floor_techs: -4
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      // Should display the values as-is (no validation in display layer)
      expect(screen.getByText(/LD: -1/)).toBeInTheDocument();
    });

    it('should handle very large numbers in lights requirements', () => {
      const mockJob = {
        id: 'job-1',
        title: 'Test Job',
        start_date: '2024-01-15',
        departments: ['lights'],
        lightsRequirements: {
          ld: 999999,
          programmers: 1000000,
          dimmer_techs: 9999999,
          floor_techs: 10000000
        },
        tasks: []
      };

      renderWithProviders(
        <JobCardNew
          job={mockJob as any}
          onClick={() => {}}
          selectedDepartment="lights"
          department="lights"
        />
      );

      expect(screen.getByText(/LD: 999999/)).toBeInTheDocument();
      expect(screen.getByText(/Programmers: 1000000/)).toBeInTheDocument();
    });
  });
});