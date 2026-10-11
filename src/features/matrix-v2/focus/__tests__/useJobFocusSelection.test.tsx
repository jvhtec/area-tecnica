// @vitest-environment jsdom
import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useJobFocusSelection } from '@/features/matrix-v2/focus/useJobFocusSelection';

describe('useJobFocusSelection', () => {
  beforeEach(() => window.history.replaceState(null, '', '/matriz'));
  afterEach(() => document.body.replaceChildren());

  it('starts from ?trabajo= and defaults new assignments to Invitado', () => {
    window.history.replaceState(null, '', '/matriz?trabajo=job-1');
    const { result } = renderHook(() => useJobFocusSelection(true));
    expect(result.current.focusJobId).toBe('job-1');
    expect(result.current.focusStatus).toBe('invited');
  });

  it('keeps the URL in step, and leaves other parameters alone', () => {
    window.history.replaceState(null, '', '/matriz?matriz=v2');
    const { result } = renderHook(() => useJobFocusSelection(true));
    act(() => result.current.focusJob('job-2'));
    expect(window.location.search).toBe('?matriz=v2&trabajo=job-2');
    act(() => result.current.focusJob(null));
    expect(window.location.search).toBe('?matriz=v2');
    expect(result.current.focusJobId).toBeNull();
  });

  it('is never focused when Matrix v2 is off', () => {
    window.history.replaceState(null, '', '/matriz?trabajo=job-1');
    expect(renderHook(() => useJobFocusSelection(false)).result.current.focusJobId).toBeNull();
  });

  it('follows the back button', () => {
    const { result } = renderHook(() => useJobFocusSelection(true));
    window.history.replaceState(null, '', '/matriz?trabajo=job-9');
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(result.current.focusJobId).toBe('job-9');
  });

  it('Esc leaves focus', () => {
    window.history.replaceState(null, '', '/matriz?trabajo=job-1');
    const { result } = renderHook(() => useJobFocusSelection(true));
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(result.current.focusJobId).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('Esc closing a popover, a dialog or a text field does not also leave focus', () => {
    window.history.replaceState(null, '', '/matriz?trabajo=job-1');
    const { result } = renderHook(() => useJobFocusSelection(true));

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(result.current.focusJobId).toBe('job-1');
    dialog.remove();

    const input = document.createElement('input');
    document.body.append(input);
    act(() => { fireEvent.keyDown(input, { key: 'Escape' }); });
    expect(result.current.focusJobId).toBe('job-1');
  });

  it('can change the status for the session', () => {
    const { result } = renderHook(() => useJobFocusSelection(true));
    act(() => result.current.setFocusStatus('confirmed'));
    expect(result.current.focusStatus).toBe('confirmed');
  });
});
