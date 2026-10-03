/** Retain fixtures if any request is pending or its server completion is unknown. */
export function localRequestSafety() {
  let pending = 0;
  let failed = false;
  return {
    get cleanupSafe() { return pending === 0 && !failed; },
    assertSafe() {
      if (pending || failed) throw new Error('Owned fixtures retained: quiesce the isolated runtime before cleanup or further fixtures');
    },
    async run<T>(operation: () => Promise<T>): Promise<T> {
      if (failed) throw new Error('Local transport failed; runtime quiescence is required before further requests');
      pending++;
      try { return await operation(); }
      catch (error) { failed = true; throw error; }
      finally { pending--; }
    },
  };
}
