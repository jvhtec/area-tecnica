import { describe, expect, it } from 'vitest'

import { occurrenceDate } from './schedulePolicy'

describe('scheduled occurrence keys', () => {
  it('recovers the date a scheduled occurrence was minted for', () => {
    expect(occurrenceDate('2026-09-17:08:00:00')).toBe('2026-09-17')
  })

  it('recovers the date from a forced run key', () => {
    expect(occurrenceDate('manual:2026-09-17:1789670941355')).toBe('2026-09-17')
  })

  it('returns null for a key it cannot read, so the caller falls back to today', () => {
    expect(occurrenceDate('nonsense')).toBeNull()
    expect(occurrenceDate('manual:nonsense')).toBeNull()
  })

  // A resumed occurrence must keep reporting against its original day: deriving
  // the date from "now" instead would make an overnight retry summarise the
  // wrong day and write its inbox rows against it.
  it('keeps a resumed occurrence anchored to its original day', () => {
    expect(occurrenceDate('2026-09-16:08:00:00')).not.toBe('2026-09-17')
  })
})
