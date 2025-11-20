import { beforeEach, describe, expect, it, vi } from 'vitest';

type TablesState = Record<string, Array<Record<string, any>>>;

type Filter = { column: string; value: any };
type Operation = 'select' | 'delete';

type TablesRef = {
  current: TablesState;
};

type SupabaseBuilderState = {
  table: string;
  filters: Filter[];
  operation: Operation;
  single: boolean;
};

type SupabaseBuilder = {
  select: () => SupabaseBuilder;
  delete: () => SupabaseBuilder;
  eq: (column: string, value: any) => SupabaseBuilder;
  order: () => SupabaseBuilder;
  limit: () => SupabaseBuilder;
  in: () => SupabaseBuilder;
  then: (resolve: any, reject: any) => Promise<any>;
  single: () => Promise<any>;
  maybeSingle: () => Promise<any>;
};

const matchesFilters = (row: Record<string, any>, filters: Filter[]) =>
  filters.every((filter) => row?.[filter.column] === filter.value);

const applyFilters = (rows: Record<string, any>[], filters: Filter[]) => {
  if (filters.length === 0) return [...rows];
  return rows.filter((row) => matchesFilters(row, filters));
};

const runQuery = (state: SupabaseBuilderState, tablesRef: TablesRef) => {
  const tableRows = tablesRef.current[state.table] ?? [];
  if (state.operation === 'delete') {
    const remaining = tableRows.filter((row) => !matchesFilters(row, state.filters));
    const removedCount = tableRows.length - remaining.length;
    tablesRef.current[state.table] = remaining;
    return Promise.resolve({ data: { count: removedCount }, error: null });
  }

  const filtered = applyFilters(tableRows, state.filters);
  const data = state.single ? filtered[0] ?? null : filtered;
  return Promise.resolve({ data, error: null });
};

const createBuilder = (table: string, tablesRef: TablesRef): SupabaseBuilder => {
  const state: SupabaseBuilderState = {
    table,
    filters: [],
    operation: 'select',
    single: false,
  };

  const execute = () => runQuery(state, tablesRef);

  const builder: SupabaseBuilder = {
    select: () => builder,
    delete: () => {
      state.operation = 'delete';
      return builder;
    },
    eq: (column, value) => {
      state.filters.push({ column, value });
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    in: () => builder,
    then: (resolve, reject) => execute().then(resolve, reject),
    single: () => {
      state.single = true;
      return execute();
    },
    maybeSingle: () => {
      state.single = true;
      return execute();
    },
  };

  return builder;
};

const createInitialTables = (): TablesState => ({
  jobs: [{ id: 'job-1', title: 'Main Job' }],
  timesheets: [
    { id: 'ts-1', job_id: 'job-1', technician_id: 'tech-1', date: '2025-05-01' },
    { id: 'ts-2', job_id: 'job-1', technician_id: 'tech-2', date: '2025-05-02' },
  ],
  job_assignments: [
    { id: 'assign-1', job_id: 'job-1', technician_id: 'tech-1' },
    { id: 'assign-2', job_id: 'job-1', technician_id: 'tech-2' },
  ],
  job_departments: [{ id: 'dept-1', job_id: 'job-1' }],
  job_date_types: [{ id: 'date-1', job_id: 'job-1' }],
  festival_logos: [{ id: 'logo-1', job_id: 'job-1' }],
  flex_folders: [{ id: 'folder-1', job_id: 'job-1' }],
  flex_crew_calls: [
    {
      id: 'crew-call-1',
      job_id: 'job-1',
      department: 'sound',
      flex_crew_assignments: [],
    },
  ],
});

const tablesRef: TablesRef = {
  current: createInitialTables(),
};

const supabaseStub = {
  from: (table: string) => createBuilder(table, tablesRef),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseStub,
}));

let deleteJobWithCleanup: typeof import('../jobDeletionService').deleteJobWithCleanup;

describe('deleteJobWithCleanup', () => {
  beforeEach(async () => {
    tablesRef.current = createInitialTables();
    supabaseStub.functions.invoke.mockClear();
    vi.resetModules();
    ({ deleteJobWithCleanup } = await import('../jobDeletionService'));
  });

  it('removes per-day timesheets before deleting assignments and the job record', async () => {
    await deleteJobWithCleanup('job-1');

    expect(tablesRef.current.timesheets).toHaveLength(0);
    expect(tablesRef.current.job_assignments).toHaveLength(0);
    expect(tablesRef.current.jobs).toHaveLength(0);
  });
});
