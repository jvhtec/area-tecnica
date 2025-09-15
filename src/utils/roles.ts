// Centralized role definitions per department for assignment and staffing

export function getDepartmentRoles(department: string): string[] {
  switch ((department || '').toLowerCase()) {
    case 'sound':
      return ['FOH Engineer', 'Monitor Engineer', 'RF Technician', 'PA Technician'];
    case 'lights':
      return ['Lighting Designer', 'Lighting Technician', 'Follow Spot', 'Rigger'];
    case 'video':
      return ['Video Director', 'Video Technician', 'Camera Operator', 'Playback Technician'];
    default:
      return ['Technician', 'Stagehand', 'Other'];
  }
}

