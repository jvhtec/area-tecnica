// Stable document slots must be mutated serially per tour so a defaults or
// rename sync cannot race a per-date override sync and finish with older data.
const pending = new Map<string, Promise<unknown>>();

export const withTourDefaultDocumentMutationLock = <T>(
  tourId: string,
  mutation: () => Promise<T>
): Promise<T> => {
  const run = (pending.get(tourId) ?? Promise.resolve()).then(mutation, mutation);
  const clear = () => {
    if (pending.get(tourId) === run) pending.delete(tourId);
  };
  pending.set(tourId, run);
  void run.then(clear, clear);
  return run;
};
