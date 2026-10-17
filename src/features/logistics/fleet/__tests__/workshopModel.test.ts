import { describe, expect, it } from "vitest";
import { validateWorkshopDraft, workshopBlocks, workshopMonthBounds, workshopOnDay, type WorkshopDraft } from "../workshopModel";

const draft: WorkshopDraft = { vehicleId: "vehicle", start: "2026-09-29T09:00", end: "2026-09-29T11:00", workshop: "Taller Norte", reason: "Revisión", notes: "", mileage: "0", status: "scheduled" };

describe("citas de taller", () => {
  it("incluye febrero bisiesto y diciembre completos", () => {
    expect(workshopMonthBounds("2028-02").days).toHaveLength(29);
    expect(workshopMonthBounds("2026-12").last).toBe("2026-12-31");
  });
  it("muestra una estancia que empieza antes del mes y termina dentro", () => {
    const appointment = { starts_at: "2026-08-31T10:00:00Z", ends_at: "2026-09-02T08:00:00Z" };
    expect(workshopOnDay(appointment, "2026-09-01")).toBe(true);
    expect(workshopOnDay(appointment, "2026-09-02")).toBe(true);
    expect(workshopOnDay(appointment, "2026-09-03")).toBe(false);
  });
  it("no ocupa el día siguiente al terminar exactamente a medianoche de Madrid", () => {
    const appointment = { starts_at: "2026-09-29T07:00:00Z", ends_at: "2026-09-29T22:00:00Z" };
    expect(workshopOnDay(appointment, "2026-09-29")).toBe(true);
    expect(workshopOnDay(appointment, "2026-09-30")).toBe(false);
  });
  it("usa días de Madrid de 23 y 25 horas en los cambios de hora", () => {
    expect(workshopOnDay({ starts_at: "2026-03-29T21:45:00Z", ends_at: "2026-03-29T22:00:00Z" }, "2026-03-30")).toBe(false);
    expect(workshopOnDay({ starts_at: "2026-10-25T22:15:00Z", ends_at: "2026-10-25T22:45:00Z" }, "2026-10-25")).toBe(true);
  });
  it("exige taller, motivo y una estancia de duración positiva", () => {
    expect(validateWorkshopDraft(draft)).toBeNull();
    expect(validateWorkshopDraft({ ...draft, workshop: " " })).not.toBeNull();
    expect(validateWorkshopDraft({ ...draft, end: draft.start })).not.toBeNull();
    expect(validateWorkshopDraft({ ...draft, start: "2026-03-29T02:30" })).not.toBeNull();
    expect(validateWorkshopDraft({ ...draft, mileage: "-1" })).not.toBeNull();
    expect(validateWorkshopDraft({ ...draft, mileage: "1.5" })).not.toBeNull();
  });
  it("libera el vehículo al finalizar o cancelar, conservando la cita", () => {
    expect(workshopBlocks({ status: "scheduled" })).toBe(true);
    expect(workshopBlocks({ status: "in_progress" })).toBe(true);
    expect(workshopBlocks({ status: "completed" })).toBe(false);
    expect(workshopBlocks({ status: "cancelled" })).toBe(false);
  });
});
