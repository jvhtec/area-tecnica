export type Dept = 'sound' | 'lights' | 'video';

export type StageShiftRecipientRow = {
  id: string;
  department?: string | null;
};

export type StageAssignmentRecipientRow = {
  shift_id?: string | null;
  technician_id?: string | null;
  role?: string | null;
};

export type StageProfileRecipientRow = {
  id: string;
  department?: string | null;
};

export type WahaParticipantObject = {
  id: string;
};

const normalizeDepartment = (value?: string | null): Dept | null => {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === 'sound' || normalized === 'lights' || normalized === 'video' ? normalized : null;
};

export const phoneToWahaJid = (phone: string) => `${phone.replace(/^\+/, '').replace(/\D/g, '')}@c.us`;

export const inferDepartmentFromFestivalAssignmentRole = (role?: string | null): Dept | null => {
  const normalized = (role || '').trim().toUpperCase();
  if (!normalized) return null;

  if (normalized.startsWith('SND-')) return 'sound';
  if (normalized.startsWith('LGT-')) return 'lights';
  if (normalized.startsWith('VID-')) return 'video';

  return null;
};

export const assignmentMatchesFestivalWhatsappDepartment = ({
  assignment,
  department,
  profile,
  shift,
}: {
  assignment: StageAssignmentRecipientRow;
  department: Dept;
  profile?: StageProfileRecipientRow | null;
  shift?: StageShiftRecipientRow | null;
}) => {
  const shiftDepartment = normalizeDepartment(shift?.department);
  if (shiftDepartment) return shiftDepartment === department;

  const roleDepartment = inferDepartmentFromFestivalAssignmentRole(assignment.role);
  if (roleDepartment) return roleDepartment === department;

  return normalizeDepartment(profile?.department) === department;
};

export const resolveFestivalWhatsappStageTechnicianIds = ({
  assignments,
  department,
  profilesById,
  shiftsById,
}: {
  assignments: StageAssignmentRecipientRow[];
  department: Dept;
  profilesById: ReadonlyMap<string, StageProfileRecipientRow>;
  shiftsById: ReadonlyMap<string, StageShiftRecipientRow>;
}) => {
  const ids = new Set<string>();

  for (const assignment of assignments) {
    const technicianId = assignment.technician_id;
    if (!technicianId) continue;

    const matchesDepartment = assignmentMatchesFestivalWhatsappDepartment({
      assignment,
      department,
      profile: profilesById.get(technicianId),
      shift: assignment.shift_id ? shiftsById.get(assignment.shift_id) : null,
    });

    if (matchesDepartment) {
      ids.add(technicianId);
    }
  }

  return Array.from(ids);
};

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
