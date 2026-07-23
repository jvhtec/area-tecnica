import type { CrewAssignmentsFeed, Dept } from "./types";

export type WallboardJobRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string | null;
  location_id: string | null;
  job_type: string | null;
  tour_id: string | null;
  timezone?: string | null;
  color?: string | null;
};

export type TourMetaRow = { id: string; status: string | null };
export type DepartmentRow = { job_id: string; department: string | null };
export type AssignmentRow = {
  job_id: string;
  technician_id: string | null;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
};
export type RequiredRoleRow = { job_id: string; department: string | null; total_required: number | null };
export type LocationRow = { id: string; name: string | null };
export type DocCountRow = { job_id: string; department: string | null; have: number | null };
export type DocRequirementRow = { department: string | null; need: number | null };
export type ProfileRow = { id: string; first_name: string | null; last_name: string | null; department: string | null };
export type LogisticsEventRow = {
  id: string;
  event_date: string;
  event_time: string;
  title: string | null;
  transport_type: string | null;
  license_plate: string | null;
  job_id: string | null;
  event_type: string | null;
  loading_bay: string | null;
  color?: string | null;
  logistics_event_departments?: Array<{ department: string | null }> | null;
};
export type CrewDraft = CrewAssignmentsFeed["jobs"][number]["crew"][number] & { technician_id: string };
export type CrewJobDraft = Omit<CrewAssignmentsFeed["jobs"][number], "crew"> & { crew: CrewDraft[] };

export const isDept = (value: string | null | undefined): value is Dept =>
  value === "sound" || value === "lights" || value === "video";
