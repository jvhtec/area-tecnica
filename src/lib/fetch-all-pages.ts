/** PostgREST caps one response at max_rows (1000 by default). */
export const POSTGREST_PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Reads every page of a query whose result can exceed one response. `page`
 * builds the query for a row range; it must be ordered by a unique key so
 * pages neither overlap nor skip rows.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PageResult<T>,
  pageSize: number = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}
