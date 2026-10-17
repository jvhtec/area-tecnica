import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

// Regression: `select(..., tour:tours(name))` on jobs failed in production with
// PGRST200 because jobs has no foreign key to tours (a tour date reaches its
// tour through tour_date_id -> tour_dates). That made every job list request
// answer database_error and left the Shortcut picker empty. PostgREST is not
// available in unit tests, so pin the shape of the query instead.
describe('ios-share-import job list query', () => {
  it('does not embed tours through PostgREST (no jobs -> tours relationship)', () => {
    const columns = /const JOB_COLUMNS = "([^"]+)"/.exec(source)?.[1] ?? ''
    expect(columns).toContain('tour_id')
    expect(columns).not.toMatch(/tours?\s*\(/)
    expect(source).not.toMatch(/tour:tours/)
  })

  it('looks tour names up separately by tour_id', () => {
    expect(source).toMatch(/from\("tours"\)\.select\("id,name"\)\.in\("id", ids\)/)
  })

  it('keeps the upcoming-only filters that need no OR/AND grouping', () => {
    expect(source).toMatch(/\.in\("status", UPCOMING_STATUSES\)\.gte\("end_time", upcomingCutoffIso\(\)\)/)
    expect(source).toMatch(/const UPCOMING_STATUSES = \["Tentativa", "Confirmado"\]/)
  })
})
