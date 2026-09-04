import { ESTRUCTURA_DEPARTMENT } from '@/domain/estructura';
import type { ResponsibleRole, SetupDepartment } from './types';

type Requirement = { label: string; category: string; role: ResponsibleRole; scope: 'department' | 'global' };

export const setupRequirements = {
  personnel: { label: 'Necesidades de personal', category: 'personnel', role: 'production', scope: 'department' },
  pesos: { label: 'Pesos', category: 'technical', role: 'technical', scope: 'department' },
  consumos: { label: 'Consumos', category: 'technical', role: 'technical', scope: 'department' },
  prediction: { label: 'Predicción', category: 'technical', role: 'technical', scope: 'department' },
  rigging_plot: { label: 'Rigging Plot', category: 'technical', role: 'technical', scope: 'department' },
  technical_report: { label: 'Memorias técnicas', category: 'technical', role: 'technical', scope: 'department' },
  quotation: { label: 'Presupuesto (QT)', category: 'resources', role: 'management', scope: 'department' },
  pull_sheet: { label: 'Hoja de preparación (PS)', category: 'resources', role: 'technical', scope: 'department' },
  motors: { label: 'Preparación de motores', category: 'technical', role: 'technical', scope: 'department' },
  motor_certificate: { label: 'Certificado de motores', category: 'technical', role: 'technical', scope: 'department' },
  flex_folders: { label: 'Carpetas Flex', category: 'resources', role: 'assistant', scope: 'global' },
} as const satisfies Record<string, Requirement>;

export type SetupRequirementKey = keyof typeof setupRequirements;

// Technical document vocabulary follows constants/taskTypes.ts. These are setup
// checks, not copies of the existing department task/document records.
export const departmentSetupRequirements = {
  sound: ['personnel', 'quotation', 'rigging_plot', 'prediction', 'technical_report', 'pesos', 'consumos', 'pull_sheet', 'flex_folders'],
  lights: ['personnel', 'quotation', 'rigging_plot', 'technical_report', 'pesos', 'consumos', 'pull_sheet', 'flex_folders'],
  video: ['personnel', 'quotation', 'prediction', 'technical_report', 'pesos', 'consumos', 'pull_sheet', 'flex_folders'],
  production: ['personnel', 'quotation', 'rigging_plot', 'prediction', 'technical_report', 'pesos', 'consumos', 'pull_sheet', 'flex_folders'],
  personnel: ['personnel', 'flex_folders'],
  [ESTRUCTURA_DEPARTMENT]: ['personnel', 'motors', 'pesos', 'pull_sheet', 'motor_certificate', 'flex_folders'],
} as const satisfies Record<SetupDepartment, readonly SetupRequirementKey[]>;
