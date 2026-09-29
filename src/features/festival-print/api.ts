import { dataLayerClient } from "@/services/dataLayerClient";
import type { FestivalArtistRow } from "./reportData";

/** Artists of the festival on the given stages, in show order. */
export async function fetchArtistsOnStages(
  jobId: string,
  stages: readonly number[],
): Promise<FestivalArtistRow[]> {
  const { data, error } = await dataLayerClient
    .from("festival_artists")
    .select("*")
    .eq("job_id", jobId)
    .in("stage", [...stages])
    .order("date")
    .order("stage")
    .order("show_start");
  if (error) throw error;
  return data ?? [];
}

/** Every artist of the festival. */
export async function fetchAllFestivalArtists(jobId: string): Promise<FestivalArtistRow[]> {
  const { data, error } = await dataLayerClient.from("festival_artists").select("*").eq("job_id", jobId);
  if (error) throw error;
  return data ?? [];
}

/** Stage number → name as the festival calls it; stages that were never named read "Escenario n". */
export async function fetchStageNamesByNumber(jobId: string): Promise<Record<number, string>> {
  const { data, error } = await dataLayerClient
    .from("festival_stages")
    .select("number, name")
    .eq("job_id", jobId);
  if (error) throw error;
  const names: Record<number, string> = {};
  for (const stage of data ?? []) names[Number(stage.number)] = stage.name || `Escenario ${stage.number}`;
  return names;
}

export interface ShiftProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  role: string | null;
}

export interface FestivalShiftRow {
  id: string;
  job_id: string;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  department: string | null;
  stage: number | null;
}

export interface FestivalShiftAssignmentRow {
  id: string;
  shift_id: string;
  technician_id: string | null;
  external_technician_name: string | null;
  role: string;
}

/** The festival's shifts (in date/start order) on the given stages, with their assignments and the assigned staff. */
export async function fetchShiftsForPrint(jobId: string, stages: readonly number[]) {
  const { data: shifts, error } = await dataLayerClient
    .from("festival_shifts")
    .select("id, job_id, name, date, start_time, end_time, department, stage")
    .eq("job_id", jobId)
    .order("date")
    .order("start_time");
  if (error) throw error;

  // A shift without a stage belongs to every stage.
  const onStages = (shifts ?? []).filter((shift) => !shift.stage || stages.includes(Number(shift.stage)));
  if (onStages.length === 0) {
    return { shifts: onStages, assignments: [], profilesById: new Map<string, ShiftProfile>() };
  }

  const { data: assignments, error: assignmentsError } = await dataLayerClient
    .from("festival_shift_assignments")
    .select("id, shift_id, technician_id, external_technician_name, role")
    .in("shift_id", onStages.map((shift) => shift.id));
  if (assignmentsError) throw assignmentsError;

  const technicianIds = [
    ...new Set((assignments ?? []).flatMap((assignment) => (assignment.technician_id ? [assignment.technician_id] : []))),
  ];
  const profilesById = new Map<string, ShiftProfile>();
  if (technicianIds.length > 0) {
    const { data: profiles, error: profilesError } = await dataLayerClient
      .from("profiles")
      .select("id, first_name, last_name, email, department, role")
      .in("id", technicianIds);
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
  }

  return { shifts: onStages, assignments: assignments ?? [], profilesById };
}

export interface CorporateEmailInput {
  subject: string;
  bodyHtml: string;
  recipients: string[];
  pdfAttachment: { filename: string; content: string; size: number };
  senderNameOverride: string;
}

/** Sends a PDF report to external recipients through the corporate mail function. */
export async function sendReportEmail(input: CorporateEmailInput): Promise<void> {
  const { data, error } = await dataLayerClient.functions.invoke("send-corporate-email", {
    body: {
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      recipients: { emails: input.recipients },
      pdfAttachments: [input.pdfAttachment],
      senderNameOverride: input.senderNameOverride,
    },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "No se pudo enviar el correo");
}
