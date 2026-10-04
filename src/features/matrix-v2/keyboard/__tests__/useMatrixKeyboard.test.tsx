// @vitest-environment jsdom
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMatrixKeyboard, type ActiveCell } from '@/features/matrix-v2/keyboard/useMatrixKeyboard';
import { formatMadridDateKey } from '@/utils/timezoneUtils';

const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const dates = [-1, 0, 1, 2].map((offset) => new Date(today.getTime() + offset * DAY));
const keys = dates.map((date) => formatMadridDateKey(date));
const technicianIds = ['t0', 't1', 't2'];
const grid = { cellWidth: 100, cellHeight: 50, technicianWidth: 200, headerHeight: 80 };

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) => {
  const element = document.createElement('div');
  const preventDefault = vi.fn();
  const event = { key: name, target: element, currentTarget: element, preventDefault, altKey: false, metaKey: false, ctrlKey: false, ...extra } as unknown as React.KeyboardEvent<HTMLElement>;
  return { event, preventDefault, element };
};

function setup(overrides: { enabled?: boolean; blocked?: boolean } = {}) {
  const scrollTo = vi.fn();
  const scrollEl = { scrollLeft: 0, scrollTop: 0, clientWidth: 600, clientHeight: 400, scrollTo } as unknown as HTMLDivElement;
  const actions = { open: vi.fn(), confirm: vi.fn(), decline: vi.fn(), remove: vi.fn(), toggleUnavailable: vi.fn(), focusJob: vi.fn(), exitFocus: vi.fn(() => false) };
  const view = renderHook((props: { enabled: boolean; blocked: boolean }) => useMatrixKeyboard({
    enabled: props.enabled,
    technicianIds,
    dates,
    grid,
    scrollRef: { current: scrollEl },
    describeCell: (technicianId, dateKey) => `${technicianId} ${dateKey}`,
    blocked: props.blocked,
    actions,
  }), { initialProps: { enabled: overrides.enabled ?? true, blocked: overrides.blocked ?? false } });
  const press = (name: string, extra: Partial<KeyboardEventInit> = {}) => {
    const { event, preventDefault, element } = key(name, extra);
    act(() => view.result.current.onKeyDown(event));
    return { preventDefault, element };
  };
  return { view, press, actions, scrollTo };
}

describe('useMatrixKeyboard', () => {
  it('starts at the first technician, on today, the first time a key is pressed', () => {
    const { view, press } = setup();
    expect(view.result.current.active).toBeNull();
    const { preventDefault } = press('ArrowDown');
    expect(preventDefault).toHaveBeenCalled();
    expect(view.result.current.active).toEqual({ technicianId: 't0', dateKey: keys[1] });
  });

  it('moves with the arrows and announces the cell', () => {
    const { view, press } = setup();
    press('ArrowDown');
    press('ArrowRight');
    press('ArrowDown');
    expect(view.result.current.active).toEqual({ technicianId: 't1', dateKey: keys[2] });
    expect(view.result.current.announcement).toBe(`t1 ${keys[2]}`);
    expect(view.result.current.activeDescendant).toBe(`mcell-t1-${keys[2]}`);
    expect(view.result.current.ring).toEqual({ left: 200 + 2 * 100, top: 80 + 1 * 50, width: 100, height: 50 });
  });

  it('scrolls the active cell into view', () => {
    const { press, scrollTo } = setup();
    press('ArrowDown');
    press('End');
    // The last day (column 3) spans 500-600 on a 600px viewport: already visible, no scroll.
    expect(scrollTo).not.toHaveBeenCalled();
    press('ArrowDown');
    press('ArrowDown');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('runs the action keys on the active cell', () => {
    const { press, actions } = setup();
    press('ArrowDown');
    const cell: ActiveCell = { technicianId: 't0', dateKey: keys[1] };
    press('Enter');
    press(' ');
    press('c');
    press('C');
    press('x');
    press('Delete');
    press('Backspace');
    press('n');
    press('f');
    expect(actions.focusJob).toHaveBeenCalledWith(cell);
    expect(actions.open).toHaveBeenCalledTimes(2);
    expect(actions.open).toHaveBeenCalledWith(cell);
    expect(actions.confirm).toHaveBeenCalledTimes(2);
    expect(actions.decline).toHaveBeenCalledWith(cell);
    expect(actions.remove).toHaveBeenCalledTimes(2);
    expect(actions.toggleUnavailable).toHaveBeenCalledWith(cell);
  });

  it('an action key with no active cell only activates the start cell', () => {
    const { view, press, actions } = setup();
    press('c');
    expect(actions.confirm).not.toHaveBeenCalled();
    expect(view.result.current.active).toEqual({ technicianId: 't0', dateKey: keys[1] });
  });

  it('opens the help with ? and clears the active cell with Escape', () => {
    const { view, press } = setup();
    press('?');
    expect(view.result.current.helpOpen).toBe(true);
    press('ArrowDown');
    press('Escape');
    expect(view.result.current.active).toBeNull();
  });

  it('Escape with no active cell leaves job focus, and only claims the key when it did', () => {
    const { press, actions } = setup();
    actions.exitFocus.mockReturnValueOnce(true);
    expect(press('Escape').preventDefault).toHaveBeenCalled();
    expect(press('Escape').preventDefault).not.toHaveBeenCalled();
    expect(actions.exitFocus).toHaveBeenCalledTimes(2);
  });

  it('Escape drops the active cell before it leaves job focus', () => {
    const { view, press, actions } = setup();
    press('ArrowDown');
    press('Escape');
    expect(view.result.current.active).toBeNull();
    expect(actions.exitFocus).not.toHaveBeenCalled();
  });

  it('leaves Escape and browser shortcuts alone when there is nothing to do', () => {
    const { press, actions } = setup();
    expect(press('Escape').preventDefault).not.toHaveBeenCalled();
    press('ArrowDown');
    press('c', { ctrlKey: true });
    press('c', { metaKey: true });
    press('c', { altKey: true });
    expect(actions.confirm).not.toHaveBeenCalled();
  });

  it('does nothing while the inspector is open, when disabled, or for keys from inside a cell', () => {
    const blocked = setup({ blocked: true });
    expect(blocked.press('ArrowDown').preventDefault).not.toHaveBeenCalled();
    const disabled = setup({ enabled: false });
    expect(disabled.press('ArrowDown').preventDefault).not.toHaveBeenCalled();
    expect(disabled.view.result.current.ring).toBeNull();

    const { view, actions } = setup();
    const { event } = key('Enter');
    (event as unknown as { target: unknown }).target = document.createElement('button');
    act(() => view.result.current.onKeyDown(event));
    expect(actions.open).not.toHaveBeenCalled();
  });

  it('a click activates its cell so the keys carry on from there', () => {
    const { view, press } = setup();
    act(() => view.result.current.activate('t2', keys[0]));
    press('ArrowRight');
    expect(view.result.current.active).toEqual({ technicianId: 't2', dateKey: keys[1] });
  });

  it('focusing the grid shows the ring on the start cell', () => {
    const { view } = setup();
    const element = document.createElement('div');
    act(() => view.result.current.onFocus({ target: element, currentTarget: element } as unknown as React.FocusEvent<HTMLElement>));
    expect(view.result.current.active).toEqual({ technicianId: 't0', dateKey: keys[1] });
    // Focus coming from a child must not move the ring.
    act(() => view.result.current.onFocus({ target: document.createElement('button'), currentTarget: element } as unknown as React.FocusEvent<HTMLElement>));
    expect(view.result.current.active).toEqual({ technicianId: 't0', dateKey: keys[1] });
  });
});
