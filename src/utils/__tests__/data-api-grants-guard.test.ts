import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

type PublicTableCreate = {
  table: string;
  file: string;
  line: number;
};

const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

const createTablePattern =
  /\bCREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[a-z_][\w$]*)(?:\s*\.\s*(?:"[^"]+"|[a-z_][\w$]*))?)/gi;

const directGrantPattern =
  /\bGRANT\b[\s\S]*?\bON\s+(?!ALL\s+TABLES\b|SCHEMA\b|FUNCTION\b|SEQUENCE\b|TYPE\b|DATABASE\b|LANGUAGE\b)(?:TABLE\s+)?([\s\S]*?)\s+\bTO\b/gi;

/**
 * Removes SQL comments while preserving line count for useful diagnostics.
 */
function stripSqlComments(sql: string): string {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    '\n'.repeat(match.split('\n').length - 1),
  );

  return withoutBlockComments.replace(/--.*$/gm, '');
}

/**
 * Normalizes relation references and treats unqualified names as public schema.
 */
function normalizeRelationName(rawName: string): string {
  const parts = rawName
    .split('.')
    .map((part) => part.trim().replace(/^"|"$/g, '').toLowerCase())
    .filter(Boolean);

  if (parts.length === 1) {
    return `public.${parts[0]}`;
  }

  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

/**
 * Splits the relation list from a direct GRANT statement.
 */
function splitGrantRelations(rawRelations: string): string[] {
  return rawRelations
    .split(',')
    .map((relation) => relation.trim())
    .filter(Boolean);
}

/**
 * Finds public schema tables created by a migration file.
 */
function findPublicTableCreates(file: string, sql: string): PublicTableCreate[] {
  const creates: PublicTableCreate[] = [];
  const codeOnly = stripSqlComments(sql);

  for (const match of codeOnly.matchAll(createTablePattern)) {
    const table = normalizeRelationName(match[1]);
    const matchIndex = match.index ?? 0;

    if (!table.startsWith('public.')) continue;

    creates.push({
      table,
      file,
      line: codeOnly.slice(0, matchIndex).split('\n').length,
    });
  }

  return creates;
}

/**
 * Finds public schema tables referenced by direct table GRANT statements.
 */
function findDirectTableGrants(sql: string): Set<string> {
  const grants = new Set<string>();
  const codeOnly = stripSqlComments(sql);

  for (const statement of codeOnly.split(';')) {
    if (!/\bGRANT\b/i.test(statement)) continue;
    if (/\bALTER\s+DEFAULT\s+PRIVILEGES\b/i.test(statement)) continue;

    directGrantPattern.lastIndex = 0;
    const match = directGrantPattern.exec(statement);

    if (!match) continue;

    for (const rawRelation of splitGrantRelations(match[1])) {
      const relation = normalizeRelationName(rawRelation);
      if (relation.startsWith('public.')) {
        grants.add(relation);
      }
    }
  }

  return grants;
}

describe('Supabase Data API table grant guard', () => {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  it('gives every public table created by migrations an explicit direct table grant', () => {
    const publicTableCreates: PublicTableCreate[] = [];
    const directTableGrants = new Set<string>();

    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8');

      publicTableCreates.push(...findPublicTableCreates(file, content));
      for (const table of findDirectTableGrants(content)) {
        directTableGrants.add(table);
      }
    }

    const missingGrantCreates = publicTableCreates.filter(
      ({ table }) => !directTableGrants.has(table),
    );

    expect(
      missingGrantCreates,
      [
        'Public tables exposed through Supabase Data API must have explicit direct GRANT statements.',
        'Do not rely on ALTER DEFAULT PRIVILEGES for newly created tables.',
        ...missingGrantCreates.map(({ file, line, table }) => `- ${file}:${line} ${table}`),
      ].join('\n'),
    ).toEqual([]);
  });
});
