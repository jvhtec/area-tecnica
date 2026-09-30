// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ShiftWithAssignments } from "@/types/festival-scheduling";

import { ShiftAgenda } from "../ShiftAgenda";
import { ShiftBoard } from "../ShiftBoard";

const shift = (id: string, start_time: string, end_time: string, extra: Partial<ShiftWithAssignments> = {}): ShiftWithAssignments => ({
  id,
  job_id: "job-1",
  date: "2031-07-10",
  name: id,
  start_time,
  end_time,
  stage: 1,
  department: "sound",
  assignments: [],
  ...extra,
});

const withCrew = (name: string): ShiftWithAssignments["assignments"] => [
  { id: `${name}-1`, shift_id: "x", role: "runner", external_technician_name: name },
];

const stageOptions = [
  { number: 1, name: "Principal" },
  { number: 2, name: "Carpa" },
];

const shifts = [
  shift("Montaje", "09:00", "13:00", { assignments: withCrew("Pepe") }),
  shift("Noche", "22:00", "06:00", { stage: 2, department: "lights" }),
  shift("Prueba", "10:00", "12:00", { stage: null }),
];

const renderBoard = (props: Partial<React.ComponentProps<typeof ShiftBoard>> = {}) => {
  const onOpenShift = vi.fn();
  const onCreateShift = vi.fn();
  render(
    <ShiftBoard
      shifts={shifts}
      stageOptions={stageOptions}
      dayStartTime="07:00"
      laneBy="stage"
      scrollKey="2031-07-10"
      onOpenShift={onOpenShift}
      onCreateShift={onCreateShift}
      {...props}
    />,
  );
  return { onOpenShift, onCreateShift };
};

describe("ShiftBoard", () => {
  it("shows a lane per stage with each shift as a block, named for a screen reader", () => {
    renderBoard();

    for (const name of ["Principal", "Carpa", "Sin stage"]) {
      expect(screen.getByRole("group", { name })).toBeInTheDocument();
    }
    const principal = screen.getByRole("group", { name: "Principal" });
    expect(within(principal).getByRole("button", { name: "Montaje, de 09:00 a 13:00, 1 persona" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Carpa" })).getByRole("button", { name: "Noche, de 22:00 a 06:00, sin personal" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Sin stage" })).getByRole("button", { name: /^Prueba/ })).toBeInTheDocument();
  });

  it("marks an overnight shift and lists who is on a shift, or that nobody is", () => {
    renderBoard();

    const night = screen.getByRole("button", { name: /^Noche/ });
    expect(night).toHaveTextContent("+1 día");
    expect(night).toHaveTextContent("Sin personal");
    expect(screen.getByRole("button", { name: /^Montaje/ })).toHaveTextContent("Pepe");
  });

  it("opens a shift from its block", () => {
    const { onOpenShift, onCreateShift } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /^Montaje/ }));

    expect(onOpenShift).toHaveBeenCalledWith("Montaje");
    // The click belongs to the block, not to the lane behind it.
    expect(onCreateShift).not.toHaveBeenCalled();
  });

  it("starts a shift in a lane from its add button, with that stage", () => {
    const { onCreateShift } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Añadir turno en Carpa" }));

    expect(onCreateShift).toHaveBeenCalledWith({ stage: "2", department: undefined });
  });

  it("starts a shift where an empty part of a lane is clicked, rounded to the half hour", () => {
    const { onCreateShift } = renderBoard();

    // 48 px per hour and a lane whose top is at 0 in jsdom: y = 100 is 125 minutes after 07:00.
    fireEvent.click(screen.getByRole("group", { name: "Carpa" }), { clientY: 100 });

    expect(onCreateShift).toHaveBeenCalledWith({ start_time: "09:00", end_time: "10:00", stage: "2", department: undefined });
  });

  it("groups by department when asked, and a new shift there gets the department", () => {
    const { onCreateShift } = renderBoard({ laneBy: "department" });

    expect(screen.getByRole("group", { name: "Sonido" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Luces" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir turno en Luces" }));
    expect(onCreateShift).toHaveBeenCalledWith({ stage: undefined, department: "lights" });
  });

  it("labels the hours from the festival day start", () => {
    renderBoard({ dayStartTime: "06:00" });

    const gutter = screen.getByTestId("shift-board").querySelector('[aria-hidden="true"]') as HTMLElement;
    const labels = Array.from(gutter.querySelectorAll("span")).map((node) => node.textContent);
    expect(labels[0]).toBe("06:00");
    expect(labels).toHaveLength(24);
  });

  it("is read only for a viewer who cannot edit: shifts open, nothing can be created", () => {
    const { onOpenShift, onCreateShift } = renderBoard({ isViewOnly: true });

    expect(screen.queryByRole("button", { name: /^Añadir turno/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("group", { name: "Carpa" }), { clientY: 100 });
    expect(onCreateShift).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Montaje/ }));
    expect(onOpenShift).toHaveBeenCalledWith("Montaje");
  });
});

describe("ShiftAgenda", () => {
  const renderAgenda = (props: Partial<React.ComponentProps<typeof ShiftAgenda>> = {}) => {
    const onOpenShift = vi.fn();
    const onCreateShift = vi.fn();
    render(
      <ShiftAgenda
        shifts={[...shifts, shift("Temprano", "08:00", "09:00", { assignments: withCrew("Ana") })]}
        stageOptions={stageOptions}
        dayStartTime="07:00"
        laneBy="stage"
        onOpenShift={onOpenShift}
        onCreateShift={onCreateShift}
        {...props}
      />,
    );
    return { onOpenShift, onCreateShift };
  };

  it("has a section per stage with its shifts in day order", () => {
    renderAgenda();

    const principal = screen.getByRole("region", { name: "Principal" });
    const names = within(principal)
      .getAllByRole("button", { name: /de \d\d:\d\d a/ })
      .map((button) => button.getAttribute("aria-label")?.split(",")[0]);
    expect(names).toEqual(["Temprano", "Montaje"]);
  });

  it("shows time, duration, overnight marker and crew on each card", () => {
    renderAgenda();

    const night = screen.getByRole("button", { name: /^Noche/ });
    expect(night).toHaveTextContent("22:00 – 06:00");
    expect(night).toHaveTextContent("8 h");
    expect(night).toHaveTextContent("+1 día");
    expect(night).toHaveTextContent("Luces");
    expect(night).toHaveTextContent("Sin personal");
    expect(screen.getByRole("button", { name: /^Temprano/ })).toHaveTextContent("Ana");
  });

  it("opens a shift from its card and starts one in a section", () => {
    const { onOpenShift, onCreateShift } = renderAgenda();

    fireEvent.click(screen.getByRole("button", { name: /^Montaje/ }));
    expect(onOpenShift).toHaveBeenCalledWith("Montaje");

    fireEvent.click(screen.getByRole("button", { name: "Añadir turno en Carpa" }));
    expect(onCreateShift).toHaveBeenCalledWith({ stage: "2", department: undefined });
  });

  it("hides sections without shifts from a viewer who cannot add to them", () => {
    renderAgenda({ isViewOnly: true, shifts: [shifts[0]] });

    expect(screen.getByRole("region", { name: "Principal" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Carpa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Añadir turno/ })).not.toBeInTheDocument();
  });

  it("says a section has no shifts when one can be added to it", () => {
    renderAgenda({ shifts: [shifts[0]] });

    expect(within(screen.getByRole("region", { name: "Carpa" })).getByText("Sin turnos.")).toBeInTheDocument();
  });
});
