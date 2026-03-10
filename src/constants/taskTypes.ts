import { type Dept } from '@/utils/tasks';

export const TASK_TYPES: Record<Dept, string[]> = {
  sound: ['QT', 'Rigging Plot', 'Prediccion', 'Memorias técnicas', 'Pesos', 'Consumos', 'PS'],
  lights: ['QT', 'Rigging Plot', 'Memorias técnicas', 'Pesos', 'Consumos', 'PS'],
  video: ['QT', 'Prediccion', 'Memorias técnicas', 'Pesos', 'Consumos', 'PS'],
  production: ['QT', 'Rigging Plot', 'Prediccion', 'Memorias técnicas', 'Pesos', 'Consumos', 'PS'],
  administrative: ['QT', 'Prediccion', 'Memorias técnicas', 'Pesos', 'Consumos', 'PS'],
};
