import { MutationCache, type MutationOptions, type MutationState, type QueryClient } from "@tanstack/react-query";
import { getPrivateDataScope } from "@/lib/private-data-scope";

/** Clearing a QueryClient does not cancel mutations. Bind execution, retries
 * and callbacks to the identity present when the mutation was constructed. */
export class PrivateMutationCache extends MutationCache {
  override build<TData, TError, TVariables, TContext>(
    client: QueryClient,
    options: MutationOptions<TData, TError, TVariables, TContext>,
    state?: MutationState<TData, TError, TVariables, TContext>,
  ) {
    const mutation = super.build(client, options, state);
    const scope = getPrivateDataScope();
    // Public auth flows may establish an identity themselves.
    if (!scope) return mutation;
    const setOptions = mutation.setOptions.bind(mutation);
    // Observers update options when components rerender. Keep the boundary
    // even when such an update happens while the mutation is paused/retrying.
    mutation.setOptions = (next) => {
      const { mutationFn, onMutate, onSuccess, onError, onSettled, retry } = next;
      setOptions({
        ...next,
        mutationFn: mutationFn ? async (...args) => {
          scope.assertCurrent();
          const result = await mutationFn(...args);
          scope.assertCurrent();
          return result;
        } : undefined,
        onMutate: onMutate ? async (...args) => {
          scope.assertCurrent();
          const result = await onMutate(...args);
          scope.assertCurrent();
          return result;
        } : undefined,
        onSuccess: (...args) => scope.signal.aborted ? undefined : onSuccess?.(...args),
        onError: (...args) => scope.signal.aborted ? undefined : onError?.(...args),
        onSettled: (...args) => scope.signal.aborted ? undefined : onSettled?.(...args),
        retry: (failures, error) => !scope.signal.aborted && (
          typeof retry === "function" ? retry(failures, error) : retry === true || failures < (retry || 0)
        ),
      });
    };
    mutation.setOptions(mutation.options);
    return mutation;
  }
}
