import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SYSTEM_NAMES } from '@/lib/errorTracking'

/**
 * The TypeScript ↔ database contract for `system_errors.system`.
 *
 * `SYSTEM_NAMES` is the source of truth, but the same list has to exist in SQL
 * twice — once in the migration that defines the CHECK constraint, and once in
 * the pgTAP test that verifies the live database matches it. SQL cannot import
 * TypeScript, so nothing stops those copies drifting apart.
 *
 * That drift is not hypothetical and it is not cosmetic. Adding a name to the
 * union without a migration compiles, ships, and then fails at INSERT time in
 * production — on the code path that exists to report failures, so the failure
 * to report is itself unreported. The reverse (SQL widened, union not) silently
 * makes a subsystem unreachable from the client.
 *
 * The pgTAP test cannot catch either case: it compares the database against its
 * own hard-coded array, so both sides can be wrong together and still pass. It
 * proves *migration → live database*. This test proves *TypeScript → SQL*.
 * Chained, the two give the property the pair is actually claimed to have.
 */

const repoRoot = join(__dirname, '..', '..', '..')

const MIGRATION = join(
  repoRoot,
  'supabase/migrations/20260903120000_widen_system_errors_systems.sql',
)
const PGTAP = join(
  repoRoot,
  'supabase/tests/database/system_errors_reporting_surface.sql',
)

/**
 * Pull the quoted subsystem names out of a `CHECK (... = ANY (ARRAY[...]))`
 * block, ignoring anything outside it — SQL comments in these files mention
 * names like 'billing' by way of explanation, and those must not be collected.
 */
function allowlistFromCheckConstraint(sql: string): string[] {
  const arrayBlock = /=\s*ANY\s*\(\s*ARRAY\s*\[([\s\S]*?)\]\s*\)/.exec(sql)
  if (!arrayBlock) throw new Error('no CHECK ... = ANY (ARRAY[...]) block found')
  return quotedNames(stripSqlComments(arrayBlock[1]))
}

/** The canonical expected array the pgTAP `is(...)` assertion compares against. */
function expectedArrayFromPgTap(sql: string): string[] {
  const marker = sql.indexOf('SELECT is(')
  if (marker === -1) throw new Error('no is(...) assertion found')
  const arrayBlock = /ARRAY\s*\[([\s\S]*?)\]/.exec(sql.slice(marker))
  if (!arrayBlock) throw new Error('no expected ARRAY[...] found in the assertion')
  return quotedNames(stripSqlComments(arrayBlock[1]))
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

function quotedNames(fragment: string): string[] {
  return [...fragment.matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

describe('system_errors subsystem allowlist contract', () => {
  const expected = [...SYSTEM_NAMES].sort()

  it('the migration CHECK constraint matches SYSTEM_NAMES exactly', () => {
    const fromMigration = allowlistFromCheckConstraint(readFileSync(MIGRATION, 'utf8')).sort()

    expect(fromMigration).toEqual(expected)
  })

  it('the pgTAP expected array matches SYSTEM_NAMES exactly', () => {
    const fromPgTap = expectedArrayFromPgTap(readFileSync(PGTAP, 'utf8')).sort()

    expect(fromPgTap).toEqual(expected)
  })

  it('SYSTEM_NAMES has no duplicates', () => {
    expect(new Set(SYSTEM_NAMES).size).toBe(SYSTEM_NAMES.length)
  })

  // The parsers are the load-bearing part of this test: one that quietly
  // returned [] would make every assertion above pass against any SQL at all.
  describe('the SQL parsers actually parse', () => {
    it('reads the real allowlist out of a CHECK constraint', () => {
      expect(
        allowlistFromCheckConstraint(
          `ALTER TABLE t ADD CONSTRAINT c CHECK ("system" = ANY (ARRAY[
             -- a comment mentioning 'billing' must be ignored
             'timesheets'::"text",
             'ui'::"text"
           ])) NOT VALID;`,
        ),
      ).toEqual(['timesheets', 'ui'])
    })

    it('reads the expected array out of a pgTAP assertion', () => {
      expect(
        expectedArrayFromPgTap(
          `SELECT ok(1, 'unrelated');\nSELECT is(\n  (SELECT x FROM y),\n  ARRAY['timesheets', 'ui'],\n  'message'\n);`,
        ),
      ).toEqual(['timesheets', 'ui'])
    })

    it('throws rather than returning empty when the block is missing', () => {
      expect(() => allowlistFromCheckConstraint('ALTER TABLE t ADD COLUMN c text;')).toThrow()
      expect(() => expectedArrayFromPgTap('SELECT plan(1);')).toThrow()
    })
  })
})
