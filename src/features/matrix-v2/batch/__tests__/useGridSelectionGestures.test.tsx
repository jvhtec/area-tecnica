// @vitest-environment jsdom
import { act, fireEvent, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGridSelectionGestures } from '@/features/matrix-v2/batch/useGridSelectionGestures';
import { cellKey } from '@/features/matrix-v2/batch/selection';

const IDS = ['t0', 't1', 't2'];
const KEYS = ['2026-10-12', '2026-10-13', '2026-10-14'];
const grid = { cellWidth: 100, cellHeight: 50, technicianWidth: 200, headerHeight: 80 };

const cellElement = (technicianId: string, dateKey: string) => {
  const element = document.createElement('div');
  element.dataset.technicianId = technicianId;
  element.dataset.dateKey = dateKey;
  document.body.append(element);
  return element;
};

function setup(overrides: { selectedCells?: Set<string>; enabled?: boolean; active?: { technicianId: string; dateKey: string } | null } = {}) {
  const onReplaceSelection = vi.fn();
  const props = {
    enabled: overrides.enabled ?? true,
    clearOnEscape: true,
    technicianIds: IDS,
    dateKeys: KEYS,
    selectedCells: overrides.selectedCells ?? new Set<string>(),
    onReplaceSelection,
    getFallbackAnchor: () => overrides.active ?? null,
    scrollRef: { current: null },
    grid,
  };
  const view = renderHook((hookProps: typeof props) => useGridSelectionGestures(hookProps), { initialProps: props });
  const click = (element: HTMLElement, extra: Partial<MouseEvent> = {}) => {
    const stopPropagation = vi.fn();
    const preventDefault = vi.fn();
    const event = { target: element, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, stopPropagation, preventDefault, ...extra } as unknown as React.MouseEvent<HTMLElement>;
    act(() => view.result.current.gridHandlers.onClickCapture(event));
    return { stopPropagation, preventDefault };
  };
  return { view, click, onReplaceSelection };
}

describe('useGridSelectionGestures', () => {
  afterEach(() => document.body.replaceChildren());

  it('shift-click selects the rectangle from the ctrl-clicked cell and keeps the click from reaching the cell', () => {
    const { click, onReplaceSelection } = setup();
    click(cellElement('t0', KEYS[0]), { ctrlKey: true });
    const { stopPropagation } = click(cellElement('t2', KEYS[1]), { shiftKey: true });
    expect(stopPropagation).toHaveBeenCalled();
    const keys = onReplaceSelection.mock.calls[0][0] as Set<string>;
    expect(keys.size).toBe(6);
    expect(keys.has(cellKey('t1', KEYS[1]))).toBe(true);
    expect(keys.has(cellKey('t1', KEYS[2]))).toBe(false);
  });

  it('shift-click with no anchor falls back to the keyboard cell, then to the clicked cell alone', () => {
    const withActive = setup({ active: { technicianId: 't0', dateKey: KEYS[0] } });
    withActive.click(cellElement('t1', KEYS[1]), { shiftKey: true });
    expect((withActive.onReplaceSelection.mock.calls[0][0] as Set<string>).size).toBe(4);

    const alone = setup();
    alone.click(cellElement('t1', KEYS[1]), { shiftKey: true });
    expect((alone.onReplaceSelection.mock.calls[0][0] as Set<string>).size).toBe(1);
  });

  it('ctrl+shift adds the range to what is selected', () => {
    const existing = new Set([cellKey('t2', KEYS[2])]);
    const { click, onReplaceSelection } = setup({ selectedCells: existing });
    click(cellElement('t0', KEYS[0]), { ctrlKey: true });
    click(cellElement('t0', KEYS[1]), { shiftKey: true, ctrlKey: true });
    const keys = onReplaceSelection.mock.calls[0][0] as Set<string>;
    expect(keys.has(cellKey('t2', KEYS[2]))).toBe(true);
    expect(keys.size).toBe(3);
  });

  it('leaves plain clicks and clicks outside any cell alone', () => {
    const { click, onReplaceSelection } = setup();
    const plain = click(cellElement('t0', KEYS[0]));
    expect(plain.stopPropagation).not.toHaveBeenCalled();
    click(document.createElement('div'), { shiftKey: true });
    expect(onReplaceSelection).not.toHaveBeenCalled();
  });

  it('does nothing when it is not enabled (phones, Matrix v1)', () => {
    const { click, onReplaceSelection, view } = setup({ enabled: false });
    click(cellElement('t0', KEYS[0]), { shiftKey: true });
    expect(onReplaceSelection).not.toHaveBeenCalled();
    expect(view.result.current.gridHandlers).not.toHaveProperty('data-no-drag');
  });

  it('marks the grid so the pan hook leaves its drags alone', () => {
    expect(setup().view.result.current.gridHandlers).toHaveProperty('data-no-drag', 'true');
  });

  it('Esc drops the selection, but not when it is closing a dialog or a text field', () => {
    const { onReplaceSelection } = setup({ selectedCells: new Set([cellKey('t0', KEYS[0])]) });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onReplaceSelection).not.toHaveBeenCalled();
    dialog.remove();
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onReplaceSelection).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onReplaceSelection).toHaveBeenCalledWith(new Set());
  });

  it('Esc does nothing without a selection', () => {
    const { onReplaceSelection } = setup();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onReplaceSelection).not.toHaveBeenCalled();
  });
});
