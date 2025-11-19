import { describe, expect, it } from "vitest";
import {
  buildTourCrewRoster,
  TourTimesheetRow,
  TourAssignmentRoleRow,
} from "../tourTimesheetCrew";

describe("buildTourCrewRoster", () => {
  const baseTimesheets: TourTimesheetRow[] = [
    {
      job_id: "job-1",
      technician_id: "tech-1",
      date: "2025-05-01",
      profile: { first_name: "Ana", last_name: "López", phone: "+1 555-0101" },
    },
    {
      job_id: "job-1",
      technician_id: "tech-1",
      date: "2025-05-02",
      profile: { first_name: "Ana", last_name: "López", phone: "+1 555-0101" },
    },
    {
      job_id: "job-1",
      technician_id: "tech-2",
      date: "2025-05-01",
      profile: { first_name: "Bruno", last_name: "Martínez", phone: null },
    },
  ];

  const assignmentRows: TourAssignmentRoleRow[] = [
    {
      technician_id: "tech-1",
      sound_role: "FOH",
      lights_role: null,
      video_role: null,
    },
    {
      technician_id: "tech-2",
      sound_role: null,
      lights_role: "LD",
      video_role: null,
    },
  ];

  it("collapses consecutive dates per technician and keeps role labels", () => {
    const crew = buildTourCrewRoster("job-1", baseTimesheets, assignmentRows);

    expect(crew).toMatchInlineSnapshot(`
      [
        {
          "fullName": "Ana López",
          "jobId": "job-1",
          "phone": "+1 555-0101",
          "roles": [
            "Sound: FOH",
          ],
          "technicianId": "tech-1",
          "timesheetDates": [
            "2025-05-01",
            "2025-05-02",
          ],
          "timesheetRanges": [
            {
              "end": "2025-05-02",
              "start": "2025-05-01",
            },
          ],
        },
        {
          "fullName": "Bruno Martínez",
          "jobId": "job-1",
          "phone": null,
          "roles": [
            "Lights: LD",
          ],
          "technicianId": "tech-2",
          "timesheetDates": [
            "2025-05-01",
          ],
          "timesheetRanges": [
            {
              "end": "2025-05-01",
              "start": "2025-05-01",
            },
          ],
        },
      ]
    `);
  });

  it("drops technicians as soon as their last per-day timesheet disappears", () => {
    const withoutBruno = baseTimesheets.filter((row) => row.technician_id !== "tech-2");
    const crew = buildTourCrewRoster("job-1", withoutBruno, assignmentRows);

    expect(crew).toMatchInlineSnapshot(`
      [
        {
          "fullName": "Ana López",
          "jobId": "job-1",
          "phone": "+1 555-0101",
          "roles": [
            "Sound: FOH",
          ],
          "technicianId": "tech-1",
          "timesheetDates": [
            "2025-05-01",
            "2025-05-02",
          ],
          "timesheetRanges": [
            {
              "end": "2025-05-02",
              "start": "2025-05-01",
            },
          ],
        },
      ]
    `);
  });
});
