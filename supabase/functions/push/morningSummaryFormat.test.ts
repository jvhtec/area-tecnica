import { describe, expect, it } from 'vitest'

import { formatMorningSummary, formatMultiDepartmentSummary } from './morningSummaryFormat'
import type { MorningSummaryData } from './morningSummaryTypes'

const tech = (id: string, nickname: string | null, first = 'Nombre') => ({
  id, first_name: first, last_name: 'Apellido', nickname,
})

const data = (): MorningSummaryData => ({
  assignments: [{
    technician_id: 't1',
    job: { title: 'Concierto Madrid', start_time: '2026-09-17T08:00:00Z' },
    profile: { first_name: 'Ana', last_name: 'Ruiz', nickname: 'Anita' },
  }],
  unavailable: [
    { user_id: 't2', source: 'vacation', profile: { first_name: 'Beto', last_name: 'Gil', nickname: null } },
    { user_id: 't3', source: 'sick', profile: { first_name: 'Cris', last_name: 'Mor', nickname: 'Cri' } },
  ],
  allTechs: [tech('t1', 'Anita', 'Ana'), tech('t2', null, 'Beto'), tech('t3', 'Cri', 'Cris'), tech('t4', 'Dani')],
})

describe('morning summary formatting', () => {
  it('reports jobs, warehouse and each absence reason for one department', () => {
    const { title, body } = formatMorningSummary('sound', data(), '2026-09-17')

    expect(title).toBe('Resumen del día - Sonido')
    expect(body).toContain('Jueves 17 de septiembre')
    expect(body).toContain('Concierto Madrid: Anita')
    // t4 is neither assigned nor unavailable, so they are the only one in the warehouse.
    expect(body).toContain('🏢 EN ALMACÉN: Dani')
    expect(body).toContain('🏖️ DE VACACIONES: Beto')
    expect(body).toContain('🤒 ENFERMOS: Cri')
    expect(body).toContain('1/4 técnicos disponibles')
  })

  it('omits an absence reason nobody is marked with', () => {
    const { body } = formatMorningSummary('sound', data(), '2026-09-17')

    expect(body).not.toContain('DE VIAJE')
    expect(body).not.toContain('DÍA LIBRE')
  })

  it('keeps each department in its own section when several are subscribed', () => {
    const byDept = new Map([['sound', data()], ['lights', data()]])
    const { title, body } = formatMultiDepartmentSummary(['sound', 'lights'], byDept, '2026-09-17')

    expect(title).toBe('Resumen del día - Sonido, Iluminación')
    expect(body).toContain('━━━ SONIDO ━━━')
    expect(body).toContain('━━━ ILUMINACIÓN ━━━')
    expect(body.match(/técnicos disponibles/g)).toHaveLength(2)
  })

  it('skips a department with no gathered data rather than rendering an empty section', () => {
    const byDept = new Map([['sound', data()]])
    const { body } = formatMultiDepartmentSummary(['sound', 'video'], byDept, '2026-09-17')

    expect(body).toContain('━━━ SONIDO ━━━')
    expect(body).not.toContain('VÍDEO')
  })
})
