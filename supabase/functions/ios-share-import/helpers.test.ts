import { describe, expect, it } from 'vitest'

import {
  escapeLike, jobOption, madridDate, objectPath, riderPath, STALE_UPLOAD_MS, tourDocumentPath, upcomingCutoffIso,
  validArtistName, validFileName, validIsoDate,
} from './helpers'

describe('validFileName', () => {
  it('keeps unknown, Unicode and extensionless names exactly', () => {
    for (const name of ['rider.xyz123', 'Plano güiro ñ 日本.pdf', 'sin extension', 'a.b.c.tar.gz']) {
      expect(validFileName(name)).toBe(name)
    }
  })

  it('rejects separators, control characters, dot names and bad lengths', () => {
    for (const name of ['', '.', '..', 'a/b', 'a\\b', 'a\u0000b', 'a\nb', 'a\u007fb', 'x'.repeat(256)]) {
      expect(validFileName(name)).toBeNull()
    }
  })
})

describe('objectPath', () => {
  const id = '11111111-1111-4111-8111-111111111111'

  it('uses the department/job prefix the app resolves to the job_documents bucket', () => {
    expect(objectPath('sound', 'job-1', 'rider.pdf', id)).toBe(`sound/job-1/${id}.pdf`)
  })

  it('keeps unknown extensions but strips unsafe characters and never leaks the original name', () => {
    expect(objectPath('personnel', 'job-1', 'CUADRANTE 2026.xlsx', id)).toBe(`personnel/job-1/${id}.xlsx`)
    expect(objectPath('video', 'job-1', 'weird.ext!?', id)).toBe(`video/job-1/${id}.ext`)
    expect(objectPath('video', 'job-1', 'noextension', id)).toBe(`video/job-1/${id}`)
    expect(objectPath('video', 'job-1', 'a.日本', id)).toBe(`video/job-1/${id}`)
  })
})

describe('escapeLike', () => {
  it('makes LIKE metacharacters literal', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})

describe('jobOption', () => {
  const base = { id: 'abc', title: 'Festival | Norte', start_time: '2026-10-20T10:00:00Z', tour_id: null, tour_date_id: null }

  it('puts the id last and removes the separator from titles', () => {
    const option = jobOption({ ...base, job_type: 'festival' })
    expect(option).toBe('2026-10-20 | festival | Festival   Norte | abc')
    expect(option.split(' | ').at(-1)).toBe('abc')
  })

  it('distinguishes a tour from its dates and names the tour', () => {
    expect(jobOption({ ...base, job_type: 'tour' })).toContain('| Gira |')
    expect(jobOption({ ...base, job_type: 'tourdate', tourName: 'Gira Verano' })).toContain('| Fecha de gira (Gira Verano) |')
    expect(jobOption({ ...base, job_type: 'tourdate' })).toContain('| Fecha de gira |')
  })

  it('tolerates missing date and title', () => {
    expect(jobOption({ ...base, title: null, start_time: null, job_type: null })).toBe('sin fecha | Trabajo | Sin título | abc')
  })
})

describe('STALE_UPLOAD_MS', () => {
  it('outlasts the longest edge function run so a slow upload is never deleted mid-flight', () => {
    expect(STALE_UPLOAD_MS).toBeGreaterThanOrEqual(5 * 60_000)
  })
})

describe('riderPath', () => {
  it('stores riders under the artist id like the web upload', () => {
    expect(riderPath('artist-1', 'Rider final.PDF', 'obj')).toBe('artist-1/obj.PDF')
    expect(riderPath('artist-1', 'sin extension', 'obj')).toBe('artist-1/obj')
    expect(riderPath('artist-1', 'a.b!?', 'obj')).toBe('artist-1/obj.b')
  })
})

describe('tourDocumentPath', () => {
  it('matches the web tour-documents layout and keeps the extension', () => {
    expect(tourDocumentPath('tour-1', 'Rider gira.pdf', 'obj')).toBe('tours/tour-1/obj.pdf')
    expect(tourDocumentPath('tour-1', 'sin extension', 'obj')).toBe('tours/tour-1/obj')
  })
})

describe('validArtistName', () => {
  it('trims, collapses whitespace and keeps Unicode', () => {
    expect(validArtistName('  Rosalía   y  Los Ñus ')).toBe('Rosalía y Los Ñus')
  })

  it('rejects empty, control-character and overlong names', () => {
    for (const value of ['', '   ', 'a\u0000b', 'x'.repeat(121)]) {
      expect(validArtistName(value)).toBeNull()
    }
  })
})

describe('validIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(validIsoDate('2026-10-16')).toBe('2026-10-16')
    for (const value of ['2026-02-30', '2026-13-01', '16/10/2026', '2026-1-1', '']) {
      expect(validIsoDate(value)).toBeNull()
    }
  })
})

describe('madridDate / upcomingCutoffIso', () => {
  it('uses the Madrid calendar day, not the UTC one', () => {
    expect(madridDate('2026-07-14T22:30:00Z')).toBe('2026-07-15')
    expect(madridDate('2026-01-14T22:30:00Z')).toBe('2026-01-14')
  })

  it('cuts off at the start of today in Madrid', () => {
    expect(upcomingCutoffIso(new Date('2026-07-15T10:00:00Z'))).toBe('2026-07-14T22:00:00.000Z')
    // Just after midnight in Madrid is already the next day.
    expect(upcomingCutoffIso(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-14T22:00:00.000Z')
  })
})
