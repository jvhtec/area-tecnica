/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { UserRole } from '@/types/user';

// Mock the auth hook
vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: vi.fn(),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      // For testing, we render a marker showing where we would navigate
      return <div data-testid="navigate" data-to={to} />;
    },
  };
});

const renderProtectedRoute = (
  allowedRoles: UserRole[],
  userRole: UserRole | null,
  isLoading = false,
  isProfileLoading = false
) => {
  vi.mocked(useOptimizedAuth).mockReturnValue({
    userRole,
    isLoading,
    isProfileLoading,
    session: null,
    user: null,
    userDepartment: null,
    hasSoundVisionAccess: false,
    assignableAsTech: false,
    isInitialized: !isLoading,
    error: null,
    login: vi.fn(),
    signUp: vi.fn(),
    createUserAsAdmin: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    setUserRole: vi.fn(),
    setUserDepartment: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    clearCache: vi.fn(),
    getCacheStatus: vi.fn(),
  });

  return render(
    <MemoryRouter>
      <ProtectedRoute allowedRoles={allowedRoles}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading states', () => {
    it('shows loading spinner when isLoading is true', () => {
      renderProtectedRoute(['admin'], 'admin', true, false);
      
      // Should show spinner, not content
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      // Check for spinner by class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeTruthy();
    });

    it('shows loading spinner when isProfileLoading is true', () => {
      renderProtectedRoute(['admin'], 'admin', false, true);
      
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('shows loading spinner when both loading states are true', () => {
      renderProtectedRoute(['admin'], 'admin', true, true);
      
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('authorization', () => {
    it('renders children when user has allowed role', () => {
      renderProtectedRoute(['admin', 'management'], 'admin', false, false);
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('renders children when user has one of multiple allowed roles', () => {
      renderProtectedRoute(['admin', 'management', 'logistics'], 'logistics', false, false);
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('redirects when user role is not in allowed roles', () => {
      renderProtectedRoute(['admin'], 'technician', false, false);
      
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
    });

    it('redirects when user role is null', () => {
      renderProtectedRoute(['admin'], null, false, false);
      
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.getByTestId('navigate')).toBeInTheDocument();
    });
  });

  describe('role-specific scenarios', () => {
    it('allows wallboard role for wallboard-only route', () => {
      renderProtectedRoute(['wallboard'], 'wallboard', false, false);
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('blocks technician from admin route', () => {
      renderProtectedRoute(['admin', 'management'], 'technician', false, false);
      
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('allows oscar role for oscar route', () => {
      renderProtectedRoute(['oscar', 'admin'], 'oscar', false, false);
      
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });
});
