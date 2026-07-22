import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flexApiFetch } from '@/lib/flex-api-client';
import { FLEX_FOLDER_IDS } from '@/utils/flex-folders/constants';
import { getJobPresupuestoTargets, type JobPresupuestoTarget } from '@/services/flexPullsheets';

const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));
vi.mock('@/lib/flex-api-client', () => ({ flexApiFetch: vi.fn() }));

const PRESUP = FLEX_FOLDER_IDS.presupuesto;

// A supabase query builder that resolves (thenable) or via maybeSingle() to a
// fixed result, regardless of the filter chain used.
const builderFor = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'or', 'order', 'limit']) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
};

const treeResponse = (tree: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers(),
  json: vi.fn().mockResolvedValue(tree),
  text: vi.fn().mockResolvedValue(''),
});

const byId = (targets: JobPresupuestoTarget[]) =>
  new Map(targets.map((target) => [target.element_id, target]));

type QueryResult = { data: unknown; error: unknown };
type TreeNode = {
  elementId: string;
  displayName?: string;
  documentNumber?: string;
  definitionId?: string;
  children?: TreeNode[];
};

describe('getJobPresupuestoTargets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges DB presupuestos with Flex-tree presupuestos, taking names from the tree and inferring departments', async () => {
    const dbRows = [
      { element_id: 'sound-a', department: 'sound', created_at: '2026-01-01T00:00:00Z', folder_type: 'comercial_presupuesto' },
      { element_id: 'dry-1', department: 'sound', created_at: '2026-01-02T00:00:00Z', folder_type: 'dryhire_presupuesto' },
    ];

    // First flex_folders query -> presupuesto rows; second -> main folder element.
    const results: QueryResult[] = [
      { data: dbRows, error: null },
      { data: { element_id: 'main-el' }, error: null },
    ];
    fromMock.mockImplementation(() => builderFor(results.shift()!));

    const tree: TreeNode = {
      elementId: 'main-el',
      displayName: 'Main',
      children: [
        {
          elementId: 'comercial',
          displayName: 'Comercial',
          children: [
            { elementId: 'sound-a', displayName: 'Presupuesto Sonido Principal', documentNumber: 'PR01', definitionId: PRESUP, children: [] },
            {
              elementId: 'extras-luces',
              displayName: 'Extras Show - Luces',
              children: [
                { elementId: 'lights-b', displayName: 'Presupuesto', definitionId: PRESUP, children: [] },
              ],
            },
          ],
        },
        {
          elementId: 'sonido-dept',
          displayName: 'Sonido',
          children: [
            { elementId: 'flex-only', displayName: 'Presupuesto extra', definitionId: PRESUP, children: [] },
          ],
        },
      ],
    };
    vi.mocked(flexApiFetch).mockResolvedValue(treeResponse(tree) as never);

    const targets = byId(await getJobPresupuestoTargets('job-1'));

    // DB row, name/number enriched from the tree.
    expect(targets.get('sound-a')).toEqual({
      element_id: 'sound-a',
      department: 'sound',
      display_name: 'Presupuesto Sonido Principal',
      document_number: 'PR01',
      source: 'database',
    });
    // DB row absent from the tree keeps its generic label.
    expect(targets.get('dry-1')).toEqual({
      element_id: 'dry-1',
      department: 'sound',
      display_name: 'Presupuesto sound',
      source: 'database',
    });
    // Tree-only presupuesto, department inferred from its ancestor folder name.
    expect(targets.get('lights-b')).toEqual({
      element_id: 'lights-b',
      department: 'lights',
      display_name: 'Presupuesto',
      source: 'flex_api',
    });
    expect(targets.get('flex-only')).toMatchObject({
      element_id: 'flex-only',
      department: 'sound',
      source: 'flex_api',
    });
  });

  it('returns the DB rows when the Flex tree cannot be fetched', async () => {
    const dbRows = [
      { element_id: 'sound-a', department: 'sound', created_at: '2026-01-01T00:00:00Z', folder_type: 'comercial_presupuesto' },
    ];
    const results: QueryResult[] = [
      { data: dbRows, error: null },
      { data: { element_id: 'main-el' }, error: null },
    ];
    fromMock.mockImplementation(() => builderFor(results.shift()!));
    vi.mocked(flexApiFetch).mockRejectedValue(new Error('flex down'));

    const targets = await getJobPresupuestoTargets('job-1');

    expect(targets).toEqual([
      { element_id: 'sound-a', department: 'sound', display_name: 'Presupuesto sound', source: 'database' },
    ]);
  });
});
