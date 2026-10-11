// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatrixUndo } from '../types';

const mocks = vi.hoisted(() => ({ custom: vi.fn(), error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }));
vi.mock('sonner', () => ({ toast: mocks }));
import { showUndoToast } from '../undoToast';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('undo toast transport retry', () => {
  it('keeps the same undo handle available after an uncertain response', async () => {
    const undo: MatrixUndo = { commandId: 'original', expiresAt: Date.now() + 8_000, isOpen: () => true, release: vi.fn(),
      undo: vi.fn().mockResolvedValueOnce({ ok: false, reason: 'failed', message: 'Respuesta incierta' }).mockResolvedValueOnce({ ok: true }) };
    const onUndone = vi.fn();
    showUndoToast({ title: 'Asignado', undo, onUndone });
    render(mocks.custom.mock.calls[0][0]('toast-id'));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    const action = mocks.error.mock.calls[0][1].action;
    expect(action.label).toBe('Volver a intentar');
    action.onClick();
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Cambio deshecho'));
    expect(undo.undo).toHaveBeenCalledTimes(2);
    expect(onUndone).toHaveBeenCalledOnce();
  });
  it('does not offer another attempt after a definitive stale decision', async () => {
    const undo: MatrixUndo = { commandId: 'original', expiresAt: Date.now() + 8_000, isOpen: () => false, release: vi.fn(),
      undo: vi.fn().mockResolvedValue({ ok: false, reason: 'stale', message: 'El estado cambió' }) };
    showUndoToast({ title: 'Asignado', undo });
    render(mocks.custom.mock.calls[0][0]('toast-id'));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledOnce());
    expect(mocks.error.mock.calls[0][1].action).toBeUndefined();
  });
});
