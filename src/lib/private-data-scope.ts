/** Private asynchronous work is bound to one authenticated identity and its
 * authorization context. Token refresh alone does not change that context. */
export interface PrivateDataScope {
  readonly userId: string;
  readonly authorizationKey: string;
  readonly generation: number;
  readonly signal: AbortSignal;
  assertCurrent(): void;
}

export class PrivateDataScopeError extends Error {
  readonly code = "PRIVATE_DATA_SCOPE_CHANGED";
  constructor() {
    super("La sesión o los permisos han cambiado. Vuelve a abrir el trabajo.");
    this.name = "PrivateDataScopeError";
  }
}

let current: PrivateDataScope | null = null;
let controller = new AbortController();
let generation = 0;
const listeners = new Set<() => void>();

export const getPrivateDataScope = (): PrivateDataScope | null => current;

export const capturePrivateDataScope = (): PrivateDataScope => {
  if (!current) throw new PrivateDataScopeError();
  return current;
};

export const setPrivateDataIdentity = (userId: string | null, authorizationKey = "unresolved", force = false): void => {
  if (!force && current?.userId === userId && current.authorizationKey === authorizationKey) return;
  if (!current && !userId) return;
  controller.abort();
  controller = new AbortController();
  generation += 1;
  const capturedGeneration = generation;
  current = userId ? {
    userId,
    authorizationKey,
    generation,
    signal: controller.signal,
    assertCurrent() {
      if (generation !== capturedGeneration || !current) throw new PrivateDataScopeError();
    },
  } : null;
  listeners.forEach((listener) => {
    try { listener(); } catch (error) {
      // A failed UI/subscription cleanup must not interrupt auth's cache reset
      // or prevent other consumers from receiving the identity change.
      console.error("Error al actualizar el contexto de datos privados:", error);
    }
  });
};

export const invalidatePrivateDataScope = (scope: PrivateDataScope): void => {
  scope.assertCurrent();
  setPrivateDataIdentity(scope.userId, scope.authorizationKey, true);
};

export const subscribePrivateDataScope = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
