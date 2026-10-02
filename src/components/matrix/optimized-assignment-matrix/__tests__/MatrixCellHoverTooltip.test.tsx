// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MatrixCellHoverTooltip,
  type MatrixCellHoverTooltipHandle,
} from "../MatrixCellHoverTooltip";

const makeCell = (technicianId: string, dateKey: string) => {
  const cell = document.createElement("div");
  cell.dataset.matrixCell = "true";
  cell.dataset.technicianId = technicianId;
  cell.dataset.dateKey = dateKey;
  document.body.appendChild(cell);
  return cell;
};

const resolve = vi.fn((technicianId: string, dateKey: string) => ({
  displayName: `Técnico ${technicianId} ${dateKey}`,
  technician: { department: "sound" },
  hasAssignment: false,
  assignment: null,
  isUnavailable: false,
  availability: null,
  staffingStatusByDate: null,
  profileNamesMap: new Map<string, string>(),
}));

describe("MatrixCellHoverTooltip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resolve.mockClear();
  });

  afterEach(() => {
    // Unmount first: the tooltip is portalled into body.
    cleanup();
    vi.useRealTimers();
    document.querySelectorAll("[data-matrix-cell]").forEach((cell) => cell.remove());
  });

  const setup = () => {
    const ref = React.createRef<MatrixCellHoverTooltipHandle>();
    render(<MatrixCellHoverTooltip ref={ref} resolve={resolve} />);
    return ref;
  };

  it("opens after the hover delay, with the hovered cell's content", () => {
    const ref = setup();
    act(() => ref.current?.hover(makeCell("a", "2026-10-01")));

    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Técnico a 2026-10-01");
  });

  it("does not open for a cell the pointer already left", () => {
    const ref = setup();
    act(() => ref.current?.hover(makeCell("a", "2026-10-01")));
    act(() => ref.current?.hover(null));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("moves straight to a neighbouring cell once open", () => {
    const ref = setup();
    act(() => ref.current?.hover(makeCell("a", "2026-10-01")));
    act(() => vi.advanceTimersByTime(700));

    act(() => ref.current?.hover(makeCell("a", "2026-10-02")));
    expect(screen.getByRole("tooltip")).toHaveTextContent("2026-10-02");
  });

  it("closes on hide and stays warm only briefly", () => {
    const ref = setup();
    act(() => ref.current?.hover(makeCell("a", "2026-10-01")));
    act(() => vi.advanceTimersByTime(700));
    act(() => ref.current?.hide());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Within the skip window the next cell opens at once...
    act(() => ref.current?.hover(makeCell("b", "2026-10-01")));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Técnico b");
    act(() => ref.current?.hide());

    // ...after it, the normal delay applies again.
    act(() => vi.advanceTimersByTime(400));
    act(() => ref.current?.hover(makeCell("c", "2026-10-01")));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(700));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Técnico c");
  });

  it("renders nothing when the cell's data is gone", () => {
    resolve.mockReturnValueOnce(null as never);
    const ref = setup();
    act(() => ref.current?.hover(makeCell("gone", "2026-10-01")));
    act(() => vi.advanceTimersByTime(700));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
