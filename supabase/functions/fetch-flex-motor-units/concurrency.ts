/**
 * Runs asynchronous work with a fixed concurrency ceiling while preserving
 * the input order and all-settled result semantics.
 */
export async function allSettledWithConcurrency<Item, Result>(
  items: readonly Item[],
  concurrency: number,
  task: (item: Item, index: number) => Promise<Result>,
): Promise<PromiseSettledResult<Result>[]> {
  const results = new Array<PromiseSettledResult<Result>>(items.length);
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = { status: "fulfilled", value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };

  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.floor(concurrency)),
  );
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}
