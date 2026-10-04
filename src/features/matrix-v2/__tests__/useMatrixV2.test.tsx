// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'management' as string | null }));
vi.mock('@/hooks/useOptimizedAuth', () => ({ useOptimizedAuth: () => ({ userRole: auth.role }) }));

import { MATRIX_V2_DEFAULT_ON_FOR_MANAGEMENT, useMatrixV2 } from '@/features/matrix-v2/useMatrixV2';

describe('useMatrixV2', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/job-assignment-matrix');
    auth.role = 'management';
  });
  afterEach(() => window.localStorage.clear());

  it('is the default for admin and management, and for nobody else', () => {
    expect(MATRIX_V2_DEFAULT_ON_FOR_MANAGEMENT).toBe(true);
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(true);
    auth.role = 'admin';
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(true);
    auth.role = 'technician';
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(false);
    auth.role = 'house_tech';
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(false);
  });

  it('opting out sticks, and the default can be asked for again', () => {
    const { result } = renderHook(() => useMatrixV2());
    act(() => result.current.setChoice('v1'));
    expect(result.current.enabled).toBe(false);
    expect(result.current.choice).toBe('v1');
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(false);

    act(() => result.current.setChoice(null));
    expect(result.current.enabled).toBe(true);
    expect(window.localStorage.getItem('matrix-v2')).toBeNull();
  });

  it('?matriz= beats the role default and is remembered for the next visit', () => {
    window.history.replaceState(null, '', '/job-assignment-matrix?matriz=v1');
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(false);
    window.history.replaceState(null, '', '/job-assignment-matrix');
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(false);

    auth.role = 'technician';
    window.localStorage.clear();
    window.history.replaceState(null, '', '/job-assignment-matrix?matriz=v2');
    expect(renderHook(() => useMatrixV2()).result.current.enabled).toBe(true);
  });

  it('another tab, or Ajustes, changing the choice reaches this one', () => {
    const { result } = renderHook(() => useMatrixV2());
    act(() => {
      window.localStorage.setItem('matrix-v2', 'v1');
      window.dispatchEvent(new Event('matrix-v2-change'));
    });
    expect(result.current.enabled).toBe(false);
  });
});
