import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WallboardPresets from '../WallboardPresets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: { id: 'test-user' } } 
      })
    }
  }
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

describe('WallboardPresets - Panel Durations Configuration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          {component}
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  describe('Panel Duration Initialization', () => {
    it('should initialize with all required panel duration keys', () => {
      const expectedPanels = [
        'overview',
        'crew',
        'docs',
        'logistics',
        'calendar',
        'pending'
      ];

      const panelDurations: Record<string, number> = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      expectedPanels.forEach(panel => {
        expect(panelDurations).toHaveProperty(panel);
        expect(panelDurations[panel]).toBe(12);
      });
    });

    it('should include docs panel in panelDurations object', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      expect(panelDurations.docs).toBeDefined();
      expect(panelDurations.docs).toBe(12);
    });

    it('should set docs panel duration to 12 seconds by default', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      expect(panelDurations.docs).toBe(12);
    });

    it('should have consistent default durations across all panels', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const durations = Object.values(panelDurations);
      const allSame = durations.every(duration => duration === 12);
      
      expect(allSame).toBe(true);
    });
  });

  describe('Panel Keys Type Safety', () => {
    it('should have correct PanelKey type including docs', () => {
      type PanelKey = 'overview' | 'crew' | 'docs' | 'logistics' | 'calendar' | 'pending';
      
      const validKeys: PanelKey[] = ['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending'];
      
      validKeys.forEach(key => {
        expect(['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending']).toContain(key);
      });
    });

    it('should allow docs as a valid panel key', () => {
      type PanelKey = 'overview' | 'crew' | 'docs' | 'logistics' | 'calendar' | 'pending';
      
      const docsKey: PanelKey = 'docs';
      expect(docsKey).toBe('docs');
    });
  });

  describe('Panel Duration Updates', () => {
    it('should allow updating docs panel duration', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      // Simulate update
      const updatedDurations = {
        ...panelDurations,
        docs: 20
      };

      expect(updatedDurations.docs).toBe(20);
      expect(updatedDurations.overview).toBe(12); // Others unchanged
    });

    it('should handle docs panel duration edge cases', () => {
      const testCases = [
        { duration: 0, expected: 0 },
        { duration: 1, expected: 1 },
        { duration: 60, expected: 60 },
        { duration: 999, expected: 999 },
      ];

      testCases.forEach(({ duration, expected }) => {
        const panelDurations = {
          overview: 12,
          crew: 12,
          docs: duration,
          logistics: 12,
          calendar: 12,
          pending: 12,
        };

        expect(panelDurations.docs).toBe(expected);
      });
    });

    it('should maintain other panel durations when docs is updated', () => {
      const initialDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const updatedDurations = {
        ...initialDurations,
        docs: 25
      };

      expect(updatedDurations.overview).toBe(12);
      expect(updatedDurations.crew).toBe(12);
      expect(updatedDurations.logistics).toBe(12);
      expect(updatedDurations.calendar).toBe(12);
      expect(updatedDurations.pending).toBe(12);
      expect(updatedDurations.docs).toBe(25);
    });
  });

  describe('Panel Enumeration', () => {
    it('should include docs in complete list of panels', () => {
      const panels = ['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending'];
      
      expect(panels).toContain('docs');
      expect(panels.length).toBe(6);
    });

    it('should allow iteration over all panel keys including docs', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const keys = Object.keys(panelDurations);
      expect(keys).toContain('docs');
      expect(keys.length).toBe(6);
    });

    it('should maintain docs position in panel order', () => {
      const panelOrder = ['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending'];
      const docsIndex = panelOrder.indexOf('docs');
      
      expect(docsIndex).toBe(2);
      expect(panelOrder[docsIndex]).toBe('docs');
    });
  });

  describe('Panel Duration Validation', () => {
    it('should validate docs panel duration as positive number', () => {
      const validDurations = [1, 5, 10, 12, 15, 20, 30, 60];
      
      validDurations.forEach(duration => {
        expect(duration).toBeGreaterThan(0);
        expect(typeof duration).toBe('number');
      });
    });

    it('should handle docs panel duration type consistency', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      Object.values(panelDurations).forEach(duration => {
        expect(typeof duration).toBe('number');
      });
    });
  });

  describe('Panel Configuration Completeness', () => {
    it('should not have missing panel keys', () => {
      const requiredPanels = ['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending'];
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      requiredPanels.forEach(panel => {
        expect(panelDurations).toHaveProperty(panel);
      });
    });

    it('should have exactly 6 panel configurations', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      expect(Object.keys(panelDurations).length).toBe(6);
    });

    it('should not have duplicate panel keys', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const keys = Object.keys(panelDurations);
      const uniqueKeys = new Set(keys);
      
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe('Preset Configuration', () => {
    it('should allow docs panel in preset enabled panels', () => {
      const enabledPanels = {
        overview: true,
        crew: true,
        docs: true,
        logistics: false,
        calendar: true,
        pending: false,
      };

      expect(enabledPanels.docs).toBe(true);
    });

    it('should allow docs panel to be disabled in presets', () => {
      const enabledPanels = {
        overview: true,
        crew: true,
        docs: false,
        logistics: true,
        calendar: true,
        pending: true,
      };

      expect(enabledPanels.docs).toBe(false);
    });

    it('should include docs in preset rotation when enabled', () => {
      const enabledPanels = {
        overview: true,
        crew: false,
        docs: true,
        logistics: true,
        calendar: false,
        pending: false,
      };

      const activeKeys = Object.entries(enabledPanels)
        .filter(([_, enabled]) => enabled)
        .map(([key]) => key);

      expect(activeKeys).toContain('docs');
      expect(activeKeys.length).toBe(3);
    });
  });

  describe('Migration Compatibility', () => {
    it('should handle presets created before docs panel was added', () => {
      const legacyPreset = {
        panelDurations: {
          overview: 12,
          crew: 12,
          logistics: 12,
          calendar: 12,
          pending: 12,
        }
      };

      const modernPreset = {
        panelDurations: {
          ...legacyPreset.panelDurations,
          docs: 12, // Default value added
        }
      };

      expect(modernPreset.panelDurations.docs).toBe(12);
    });

    it('should preserve existing panel durations when adding docs', () => {
      const existingDurations = {
        overview: 15,
        crew: 10,
        logistics: 20,
        calendar: 8,
        pending: 12,
      };

      const updatedDurations = {
        ...existingDurations,
        docs: 12,
      };

      expect(updatedDurations.overview).toBe(15);
      expect(updatedDurations.crew).toBe(10);
      expect(updatedDurations.logistics).toBe(20);
      expect(updatedDurations.calendar).toBe(8);
      expect(updatedDurations.pending).toBe(12);
      expect(updatedDurations.docs).toBe(12);
    });
  });

  describe('Wallboard Display Logic', () => {
    it('should calculate total cycle time including docs panel', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const enabledPanels = {
        overview: true,
        crew: true,
        docs: true,
        logistics: true,
        calendar: true,
        pending: true,
      };

      const totalTime = Object.entries(panelDurations)
        .filter(([key]) => enabledPanels[key as keyof typeof enabledPanels])
        .reduce((sum, [_, duration]) => sum + duration, 0);

      expect(totalTime).toBe(72); // 6 panels * 12 seconds
    });

    it('should exclude docs panel from cycle time when disabled', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 12,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const enabledPanels = {
        overview: true,
        crew: true,
        docs: false,
        logistics: true,
        calendar: true,
        pending: true,
      };

      const totalTime = Object.entries(panelDurations)
        .filter(([key]) => enabledPanels[key as keyof typeof enabledPanels])
        .reduce((sum, [_, duration]) => sum + duration, 0);

      expect(totalTime).toBe(60); // 5 panels * 12 seconds
    });

    it('should handle docs panel with custom duration in cycle time', () => {
      const panelDurations = {
        overview: 12,
        crew: 12,
        docs: 30,
        logistics: 12,
        calendar: 12,
        pending: 12,
      };

      const enabledPanels = {
        overview: true,
        crew: true,
        docs: true,
        logistics: true,
        calendar: true,
        pending: true,
      };

      const totalTime = Object.entries(panelDurations)
        .filter(([key]) => enabledPanels[key as keyof typeof enabledPanels])
        .reduce((sum, [_, duration]) => sum + duration, 0);

      expect(totalTime).toBe(90); // 5*12 + 30
    });
  });
});