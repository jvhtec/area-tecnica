import {
  sourceLabel,
  syncStatusLabel,
} from '@/features/tour-ops/tourOpsManagementUtils';
import { describe, expect, it } from 'vitest';

describe('tour ops management labels', () => {
  it('renders persisted source labels in Spanish', () => {
    expect(sourceLabel('hoja')).toBe('Importado de hoja')
    expect(sourceLabel('legacy')).toBe('Heredado')
    expect(sourceLabel('ops')).toBe('Operaciones')
  })

  it('renders sync states in Spanish', () => {
    expect(syncStatusLabel('synced')).toBe('Sincronizado')
    expect(syncStatusLabel('needs_sync')).toBe('Requiere sincronización')
    expect(syncStatusLabel('no_hoja')).toBe('Sin hoja para la fecha')
    expect(syncStatusLabel('imported')).toBe('Importado de hoja')
    expect(syncStatusLabel('legacy')).toBe('Heredado')
    expect(syncStatusLabel('unknown')).toBe('Requiere sincronización')
  })
})
