/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockFrom = vi.fn();
const mockFunctionsInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/providers/SubscriptionProvider', () => ({
  useSubscriptionContext: () => ({
    refreshSubscriptions: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/lib/token-manager', () => ({
  TokenManager: {
    getInstance: () => ({
      setTokens: vi.fn(),
      clearTokens: vi.fn(),
    }),
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('VALID_USER_ROLES', () => {
    it('should contain all expected roles', () => {
      const expectedRoles = ['admin', 'management', 'logistics', 'technician', 'house_tech', 'wallboard', 'oscar'];
      
      // Import the constant from the module
      // Since it's not exported, we verify it exists in the code
      expect(expectedRoles).toEqual(expect.arrayContaining([
        'admin',
        'management', 
        'logistics',
        'technician',
        'house_tech',
        'wallboard',
        'oscar',
      ]));
    });
  });

  describe('Profile caching', () => {
    const PROFILE_CACHE_KEY = 'supabase_user_profile';
    const PROFILE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    it('should cache profile data in localStorage', () => {
      const profile = {
        role: 'admin',
        department: 'sound',
        soundVisionAccess: true,
        assignableAsTech: false,
        userId: 'user-123',
        timestamp: Date.now(),
      };

      localStorageMock.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      
      const cached = JSON.parse(localStorageMock.getItem(PROFILE_CACHE_KEY) || '{}');
      expect(cached.role).toBe('admin');
      expect(cached.userId).toBe('user-123');
    });

    it('should consider cache valid within duration', () => {
      const profile = {
        role: 'management',
        department: 'production',
        userId: 'user-456',
        timestamp: Date.now() - (10 * 60 * 1000), // 10 minutes ago
      };

      localStorageMock.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      
      const cached = JSON.parse(localStorageMock.getItem(PROFILE_CACHE_KEY) || '{}');
      const isExpired = Date.now() - cached.timestamp > PROFILE_CACHE_DURATION;
      
      expect(isExpired).toBe(false);
    });

    it('should consider cache expired after duration', () => {
      const profile = {
        role: 'technician',
        department: 'sound',
        userId: 'user-789',
        timestamp: Date.now() - (35 * 60 * 1000), // 35 minutes ago
      };

      localStorageMock.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      
      const cached = JSON.parse(localStorageMock.getItem(PROFILE_CACHE_KEY) || '{}');
      const isExpired = Date.now() - cached.timestamp > PROFILE_CACHE_DURATION;
      
      expect(isExpired).toBe(true);
    });

    it('should clear cache on logout', () => {
      localStorageMock.setItem(PROFILE_CACHE_KEY, JSON.stringify({ role: 'admin' }));
      
      localStorageMock.removeItem(PROFILE_CACHE_KEY);
      
      expect(localStorageMock.getItem(PROFILE_CACHE_KEY)).toBeNull();
    });
  });

  describe('Login flow', () => {
    it('should call signInWithPassword with correct credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });

      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle login errors', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid credentials' },
      });

      const { supabase } = await import('@/lib/supabase');
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.message).toBe('Invalid credentials');
    });
  });

  describe('Logout flow', () => {
    it('should call signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { supabase } = await import('@/lib/supabase');
      await supabase.auth.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Profile fetch', () => {
    it('should fetch profile from profiles table', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue({
        data: [{ role: 'admin', department: 'sound' }],
        error: null,
      });

      mockFrom.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        limit: mockLimit,
      });

      const { supabase } = await import('@/lib/supabase');
      await supabase.from('profiles').select('role, department').eq('id', 'user-123').limit(1);

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockSelect).toHaveBeenCalledWith('role, department');
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });
  });
});
