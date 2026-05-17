export function buildAssignmentConfirmedText(
  recipName: string,
  jobTitle: string,
  singleDayFlag: boolean,
  formattedTargetDate: string | null,
): string {
  if (singleDayFlag && formattedTargetDate) {
    return recipName
      ? `${recipName}, has sido asignado a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`
      : `Has sido asignado a "${jobTitle || 'Trabajo'}" para ${formattedTargetDate}.`;
  }

  return recipName
    ? `${recipName}, has sido asignado a "${jobTitle || 'Trabajo'}".`
    : `Has sido asignado a "${jobTitle || 'Trabajo'}".`;
}

export function buildDirectAssignmentTexts(
  actor: string,
  assignedTechName: string,
  jobTitle: string,
  assignmentStatus: string | undefined,
  singleDayFlag: boolean,
  formattedTargetDate: string | null,
): { techText: string; managementText: string } {
  const statusText = assignmentStatus === 'confirmed' ? 'confirmado' : 'asignado';
  const job = jobTitle || 'Trabajo';

  const techText = singleDayFlag && formattedTargetDate
    ? `${actor} te ha ${statusText} a "${job}" para ${formattedTargetDate}.`
    : `${actor} te ha ${statusText} a "${job}".`;

  if (assignedTechName) {
    return {
      techText,
      managementText: singleDayFlag && formattedTargetDate
        ? `${actor} ha ${statusText} a ${assignedTechName} a "${job}" para ${formattedTargetDate}.`
        : `${actor} ha ${statusText} a ${assignedTechName} a "${job}".`,
    };
  }

  return {
    techText,
    managementText: singleDayFlag && formattedTargetDate
      ? `${actor} ha ${statusText} un técnico a "${job}" para ${formattedTargetDate}.`
      : `${actor} ha ${statusText} un técnico a "${job}".`,
  };
}

export function buildAssignmentRemovedTexts(
  actor: string,
  removedTechName: string,
  jobTitle: string,
  singleDayFlag: boolean,
  formattedTargetDate: string | null,
): { techText: string; managementText: string } {
  const job = jobTitle || 'Trabajo';
  return {
    techText: singleDayFlag && formattedTargetDate
      ? `${actor} te ha eliminado de "${job}" para ${formattedTargetDate}.`
      : `${actor} te ha eliminado de "${job}".`,
    managementText: singleDayFlag && formattedTargetDate
      ? `${actor} ha eliminado a ${removedTechName} de "${job}" para ${formattedTargetDate}.`
      : `${actor} ha eliminado a ${removedTechName} de "${job}".`,
  };
}
