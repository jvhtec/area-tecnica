// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BatchActionBar } from '@/features/matrix-v2/batch/BatchActionBar';

const props = () => ({
  cells: 2, people: 1, canEdit: true, running: false,
  progress: null as { done: number; total: number } | null,
  jobs: [{ id: 'job-a', title: 'Trabajo A', range: '13–14 oct' }],
  removal: { pairs: 1, people: 1, days: 2 },
  onAssign: vi.fn(), onRequest: vi.fn(), channel: 'email' as const, onChannelChange: vi.fn(),
  onConfirm: vi.fn(), onRemove: vi.fn(), onMarkUnavailable: vi.fn(), onClear: vi.fn(),
});

describe('batch action busy controls', () => {
  it('disables every main action with running true and null progress, then recovers', () => {
    const options = props();
    const view = render(<BatchActionBar {...options} running />);
    const bar = screen.getByTestId('batch-bar');
    expect(bar).toHaveTextContent('Aplicando…');
    expect(bar).not.toHaveTextContent('0/0');
    for (const button of within(bar).getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(options.onMarkUnavailable).not.toHaveBeenCalled();
    expect(options.onConfirm).not.toHaveBeenCalled();
    expect(options.onClear).not.toHaveBeenCalled();
    view.rerender(<BatchActionBar {...options} />);
    for (const button of within(bar).getAllByRole('button')) expect(button).toBeEnabled();
  });

  it.each(['Asignar a…', 'Pedir disponibilidad', 'Enviar oferta'])('disables the already-open %s chooser, including its options', async label => {
    const options = props();
    const user = userEvent.setup();
    const view = render(<BatchActionBar {...options} />);
    await user.click(screen.getByRole('button', { name: label }));
    expect(screen.getByRole('button', { name: /Trabajo A/ })).toBeEnabled();
    view.rerender(<BatchActionBar {...options} running />);
    const job = screen.getByRole('button', { name: /Trabajo A/ });
    expect(job).toBeDisabled();
    fireEvent.click(job);
    for (const option of screen.getAllByRole('radio')) {
      expect(option).toBeDisabled();
      fireEvent.click(option);
    }
    expect(options.onAssign).not.toHaveBeenCalled();
    expect(options.onRequest).not.toHaveBeenCalled();
    expect(options.onChannelChange).not.toHaveBeenCalled();
  });

  it('disables removal confirmation and cancellation if another operation starts', async () => {
    const options = props();
    const view = render(<BatchActionBar {...options} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Quitar' }));
    view.rerender(<BatchActionBar {...options} running />);
    const dialog = screen.getByRole('alertdialog');
    for (const button of within(dialog).getAllByRole('button')) {
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(screen.getByRole('button', { name: 'Limpiar la selección' })).toBeDisabled();
    expect(options.onRemove).not.toHaveBeenCalled();
  });

  it('keeps the existing done/total display for row batches', () => {
    render(<BatchActionBar {...props()} progress={{ done: 1, total: 3 }} />);
    expect(screen.getByTestId('batch-bar')).toHaveTextContent('Aplicando 1/3…');
    for (const button of within(screen.getByTestId('batch-bar')).getAllByRole('button')) expect(button).toBeDisabled();
  });
});
