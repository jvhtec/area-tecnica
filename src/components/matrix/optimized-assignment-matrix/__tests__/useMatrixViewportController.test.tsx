import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMatrixViewportController } from '../useMatrixViewportController';

vi.mock('@/hooks/useDragScroll', () => ({
  useDragScroll: vi.fn(),
}));

describe('useMatrixViewportController', () => {
  const defineElementMetrics = (element: HTMLElement, metrics: Record<string, unknown>) => {
    Object.entries(metrics).forEach(([key, value]) => {
      Object.defineProperty(element, key, {
        configurable: true,
        value,
        writable: true,
      });
    });
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  it('calculates the visible window from the main scroll position', () => {
    const { result } = renderHook(() =>
      useMatrixViewportController({
        dates: Array.from({ length: 14 }, (_, index) => new Date(`2025-03-${String(index + 1).padStart(2, '0')}T00:00:00Z`)),
        technicianCount: 30,
        mobile: false,
        canExpandBefore: false,
        canExpandAfter: false,
        cellWidth: 100,
        cellHeight: 50,
        technicianWidth: 200,
        headerHeight: 80,
        isInitialLoading: false,
      }),
    );

    const main = document.createElement('div');
    defineElementMetrics(main, {
      scrollLeft: 250,
      scrollTop: 300,
      clientWidth: 400,
      clientHeight: 200,
      scrollWidth: 1400,
    });

    result.current.mainScrollRef.current = main;

    act(() => {
      result.current.handleMainScroll({ currentTarget: main } as React.UIEvent<HTMLDivElement>);
    });

    expect(result.current.visibleRows.start).toBe(0);
    expect(result.current.visibleRows.end).toBeGreaterThanOrEqual(10);
    expect(result.current.visibleCols.start).toBe(0);
    expect(result.current.visibleCols.end).toBeGreaterThanOrEqual(6);
  });

  it('handles mobile navigation by scrolling both headers and grid', () => {
    const { result } = renderHook(() =>
      useMatrixViewportController({
        dates: Array.from({ length: 10 }, (_, index) => new Date(`2025-03-${String(index + 1).padStart(2, '0')}T00:00:00Z`)),
        technicianCount: 10,
        mobile: true,
        canExpandBefore: false,
        canExpandAfter: false,
        cellWidth: 100,
        cellHeight: 50,
        technicianWidth: 200,
        headerHeight: 80,
        isInitialLoading: false,
      }),
    );

    const headers = document.createElement('div');
    defineElementMetrics(headers, {
      scrollLeft: 0,
      clientWidth: 320,
      scrollWidth: 1000,
      scrollTo: vi.fn(),
    });
    const main = document.createElement('div');
    defineElementMetrics(main, {
      scrollTop: 0,
      scrollTo: vi.fn(),
    });

    result.current.dateHeadersRef.current = headers;
    result.current.mainScrollRef.current = main;

    act(() => {
      result.current.handleMobileNav('right');
    });

    expect(headers.scrollTo).toHaveBeenCalled();
    expect(main.scrollTo).toHaveBeenCalled();
  });
});
