import { describe, expect, it } from "vitest";

import {
  buildJobDateTypeChangedMessage,
  buildJobTypeChangedMessage,
  buildJobUpdatedText,
} from "../messages/jobMessages.ts";
import {
  buildAssignmentConfirmedText,
  buildAssignmentRemovedTexts,
  buildDirectAssignmentTexts,
} from "../messages/assignmentMessages.ts";
import {
  buildLogisticsEventMessage,
  buildLogisticsTransportRequestedMessage,
} from "../messages/logisticsMessages.ts";
import {
  buildFestivalPublicFormMessage,
  buildFestivalPublicRiderMessage,
} from "../messages/festivalMessages.ts";
import { buildTaskMessage } from "../messages/taskMessages.ts";
import { buildTourDateTypeChangedMessage } from "../messages/tourMessages.ts";
import type { BroadcastBody } from "../../types.ts";

describe("push broadcast event message builders", () => {
  it("summarizes job update fields with Spanish labels", () => {
    const text = buildJobUpdatedText("Laura", "Gala Norte", {
      start_time: { from: "10:00", to: "11:00" },
      location_id: { from: "old", to: "new" },
    });

    expect(text).toBe('Laura actualizó "Gala Norte". Cambios: Inicio, Ubicación.');
  });

  it("builds job date and job type change messages by event family", () => {
    expect(buildJobDateTypeChangedMessage(
      "jobdate.type.changed.rehearsal",
      "Mario",
      "Festival Sur",
      { action: "broadcast", type: "jobdate.type.changed.rehearsal", target_date: "2026-06-05" },
    )).toMatchObject({
      title: "Fecha del trabajo: Ensayo",
      text: expect.stringContaining('Mario marcó "Festival Sur" como Ensayo para'),
    });

    expect(buildJobTypeChangedMessage(
      "job.type.changed.dryhire",
      "Mario",
      "Backline",
      { action: "broadcast", type: "job.type.changed.dryhire" },
    )).toEqual({
      title: "Trabajo cambiado a Alquiler seco",
      text: 'Mario cambió "Backline" a Alquiler seco.',
    });
  });

  it("keeps assignment messages personalized for technicians and management", () => {
    expect(buildAssignmentConfirmedText("Ana", "Showcase", true, "7 jun 2026"))
      .toBe('Ana, has sido asignado a "Showcase" para 7 jun 2026.');

    expect(buildDirectAssignmentTexts("Laura", "Ana", "Showcase", "confirmed", false, null))
      .toEqual({
        techText: 'Laura te ha confirmado a "Showcase".',
        managementText: 'Laura ha confirmado a Ana a "Showcase".',
      });

    expect(buildAssignmentRemovedTexts("Laura", "Ana", "Showcase", true, "7 jun 2026"))
      .toEqual({
        techText: 'Laura te ha eliminado de "Showcase" para 7 jun 2026.',
        managementText: 'Laura ha eliminado a Ana de "Showcase" para 7 jun 2026.',
      });
  });

  it("formats logistics transport and calendar event messages", () => {
    expect(buildLogisticsTransportRequestedMessage("Nuria", "Auditorio", {
      action: "broadcast",
      type: "logistics.transport.requested",
      department: "sound",
      description: "Furgón grande",
    })).toEqual({
      title: "Transporte solicitado",
      text: 'Nuria solicitó transporte para Sound en "Auditorio": Furgón grande',
    });

    const event = buildLogisticsEventMessage("logistics.event.updated", "Auditorio", {
      action: "broadcast",
      type: "logistics.event.updated",
      event_type: "unload",
      event_date: "2026-06-05",
      event_time: "10:30",
      transport_type: "truck",
      changes: { event_time: { from: "10:00", to: "10:30" } },
      departments: ["sound", "lights"],
    });

    expect(event.title).toBe("Descarga actualizada");
    expect(event.text).toContain('Se actualizó la descarga de "Auditorio"');
    expect(event.text).toContain("Cambios: Hora.");
    expect(event.text).toContain("Transporte: Truck.");
    expect(event.text).toContain("(sound, lights)");
  });

  it("builds festival public submission messages with optional dates and rider filenames", () => {
    const body: BroadcastBody = {
      action: "broadcast",
      type: "festival.public_rider.uploaded",
      artist_name: "La Banda",
      artist_date: "2026-07-12",
      file_name: "rider.pdf",
    };

    expect(buildFestivalPublicFormMessage(body, "Festival Centro").text)
      .toContain('La Banda envió su formulario técnico para "Festival Centro"');
    expect(buildFestivalPublicRiderMessage(body, "Festival Centro").text)
      .toContain('La Banda cargó un rider técnico para "Festival Centro": "rider.pdf".');
  });

  it("builds task and tour-date messages with context-specific copy", () => {
    const task = buildTaskMessage("task.updated", "Eva", "Pablo", {
      action: "broadcast",
      type: "task.updated",
      task_type: "revisar PA",
      changes: { due_at: { from: "2026-06-01", to: "2026-06-02" } },
    }, "Sala Principal");

    expect(task?.title).toBe("Tarea actualizada");
    expect(task?.text).toContain('Eva actualizó la tarea "revisar PA" en "Sala Principal".');
    expect(task?.changeSummary).toContain("Fecha límite:");

    expect(buildTourDateTypeChangedMessage("tourdate.type.changed.travel", "Eva", {
      action: "broadcast",
      type: "tourdate.type.changed.travel",
      location_name: "Madrid",
      tour_name: "Gira Primavera",
    })).toEqual({
      title: "Fecha cambiada a Viaje",
      text: 'Eva cambió "Madrid" a Viaje en "Gira Primavera".',
    });
  });
});
