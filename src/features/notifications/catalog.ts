export const NOTIFICATION_CATEGORIES = [
  { key: 'jobs', label: 'Trabajos' },
  { key: 'staffing', label: 'Personal y asignaciones' },
  { key: 'timesheets', label: 'Partes de horas' },
  { key: 'tasks', label: 'Tareas' },
  { key: 'messages', label: 'Mensajes' },
  { key: 'documents', label: 'Documentos' },
  { key: 'logistics', label: 'Logística' },
  { key: 'tours', label: 'Giras' },
  { key: 'festival', label: 'Festivales' },
  { key: 'finance', label: 'Gastos y pagos' },
  { key: 'system', label: 'Sistema y resúmenes' },
] as const

export type NotificationCategoryKey = typeof NOTIFICATION_CATEGORIES[number]['key']

export const categoryLabel = (category: string): string =>
  NOTIFICATION_CATEGORIES.find((item) => item.key === category)?.label ?? 'Notificación'
