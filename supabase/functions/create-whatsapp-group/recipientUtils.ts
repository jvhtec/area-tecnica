export type Dept = 'sound' | 'lights' | 'video';

export type WahaParticipantObject = {
  id: string;
};

export type FestivalStageShiftRow = {
  id: string;
  department: string | null;
};

export type FestivalStageAssignmentRow = {
  external_technician_name: string | null;
  role: string | null;
  shift_id: string | null;
  technician_id: string | null;
};

export type FestivalStageRecipientResolution = {
  assignmentCount: number;
  externalNames: string[];
  shiftCount: number;
  technicianIds: string[];
};

const ROLE_PREFIX_BY_DEPARTMENT: Record<Dept, string> = {
  sound: 'SND-',
  lights: 'LGT-',
  video: 'VID-',
};

export const phoneToWahaJid = (phone: string) => `${phone.replace(/^\+/, '').replace(/\D/g, '')}@c.us`;

export const buildWahaGroupParticipants = ({
  actorJid,
  participants,
}: {
  actorJid?: string | null;
  participants: string[];
}) => {
  const allParticipants = participants.map<WahaParticipantObject>((phone) => ({ id: phoneToWahaJid(phone) }));
  const groupParticipants = actorJid
    ? allParticipants.filter((participant) => participant.id !== actorJid)
    : allParticipants;

  return {
    allParticipants,
    groupParticipants,
  };
};

const normalizeDepartment = (department: string | null | undefined) => {
  const normalized = (department || '').trim().toLowerCase();
  return normalized === 'none' ? '' : normalized;
};

export const festivalAssignmentMatchesDepartment = (
  assignment: Pick<FestivalStageAssignmentRow, 'role'>,
  shift: Pick<FestivalStageShiftRow, 'department'> | undefined,
  department: Dept,
) => {
  const shiftDepartment = normalizeDepartment(shift?.department);
  if (shiftDepartment) return shiftDepartment === department;

  const role = (assignment.role || '').trim().toUpperCase();
  return role.startsWith(ROLE_PREFIX_BY_DEPARTMENT[department]);
};

export const collectFestivalStageRecipients = ({
  assignments,
  department,
  shifts,
}: {
  assignments: FestivalStageAssignmentRow[];
  department: Dept;
  shifts: FestivalStageShiftRow[];
}): FestivalStageRecipientResolution => {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const technicianIds: string[] = [];
  const externalNames: string[] = [];

  for (const assignment of assignments) {
    const shift = assignment.shift_id ? shiftById.get(assignment.shift_id) : undefined;
    if (!shift) continue;
    if (!festivalAssignmentMatchesDepartment(assignment, shift, department)) continue;

    if (assignment.technician_id) {
      technicianIds.push(assignment.technician_id);
    } else if (assignment.external_technician_name) {
      externalNames.push(assignment.external_technician_name);
    }
  }

  return {
    assignmentCount: assignments.length,
    externalNames: Array.from(new Set(externalNames)),
    shiftCount: shifts.length,
    technicianIds: Array.from(new Set(technicianIds)),
  };
};

export const resolveFestivalStageTechnicianIds = async ({
  department,
  jobId,
  stageNumber,
  supabase,
}: {
  department: Dept;
  jobId: string;
  stageNumber: number;
  supabase: any;
}): Promise<FestivalStageRecipientResolution> => {
  const { data: shifts, error: shiftsError } = await supabase
    .from('festival_shifts')
    .select('id, department')
    .eq('job_id', jobId)
    .eq('stage', stageNumber);

  if (shiftsError) throw shiftsError;

  const stageShifts = (shifts ?? []) as FestivalStageShiftRow[];
  if (stageShifts.length === 0) {
    return {
      assignmentCount: 0,
      externalNames: [],
      shiftCount: 0,
      technicianIds: [],
    };
  }

  const shiftIds = stageShifts.map((shift) => shift.id);
  const { data: assignments, error: assignmentsError } = await supabase
    .from('festival_shift_assignments')
    .select('shift_id, technician_id, role, external_technician_name')
    .in('shift_id', shiftIds);

  if (assignmentsError) throw assignmentsError;

  return collectFestivalStageRecipients({
    assignments: (assignments ?? []) as FestivalStageAssignmentRow[],
    department,
    shifts: stageShifts,
  });
};
