export const CODE_TO_LABEL: Record<string, string> = {
  // Sound
  'SND-FOH-R': 'FOH — Responsable',
  'SND-MON-R': 'Monitores — Responsable',
  'SND-SYS-R': 'Sistemas — Responsable',
  'SND-FOH-E': 'FOH — Especialista',
  'SND-MON-E': 'Monitores — Especialista',
  'SND-RF-E':  'RF — Especialista',
  'SND-SYS-E': 'Sistemas — Especialista',
  'SND-PA-T':  'PA — Técnico',
  // Lights
  'LGT-BRD-R': 'Mesa — Responsable',
  'LGT-SYS-R': 'Sistema/Rig — Responsable',
  'LGT-BRD-E': 'Mesa — Especialista',
  'LGT-SYS-E': 'Sistema/Rig — Especialista',
  'LGT-FOLO-E': 'Follow Spot — Especialista',
  'LGT-PA-T':  'PA — Técnico',
  // Video
  'VID-SW-R':  'Switcher/TD — Responsable',
  'VID-DIR-E': 'Director — Especialista',
  'VID-CAM-E': 'Cámara — Especialista',
  'VID-LED-E': 'LED — Especialista',
  'VID-PROJ-E': 'Proyección — Especialista',
  'VID-PA-T':  'PA — Técnico',
}

export function labelForCode(value?: string | null): string | null {
  if (!value) return null
  return CODE_TO_LABEL[value] ?? value
}

