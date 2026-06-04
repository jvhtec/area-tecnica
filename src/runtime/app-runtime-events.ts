export const APP_RUNTIME_EVENTS = {
  ONLINE: "app-runtime:online",
  OFFLINE: "app-runtime:offline",
  VISIBLE: "app-runtime:visible",
  HIDDEN: "app-runtime:hidden",
  RESUME: "app-runtime:resume",
} as const;

export type AppRuntimeEventName =
  (typeof APP_RUNTIME_EVENTS)[keyof typeof APP_RUNTIME_EVENTS];

export type AppRuntimeEventDetailMap = {
  [APP_RUNTIME_EVENTS.ONLINE]: {
    at: number;
    previousOnline: boolean;
  };
  [APP_RUNTIME_EVENTS.OFFLINE]: {
    at: number;
    previousOnline: boolean;
  };
  [APP_RUNTIME_EVENTS.VISIBLE]: {
    at: number;
    hiddenDurationMs: number;
  };
  [APP_RUNTIME_EVENTS.HIDDEN]: {
    at: number;
  };
  [APP_RUNTIME_EVENTS.RESUME]: {
    at: number;
    hiddenDurationMs: number;
  };
};

const runtimeEvents = new EventTarget();

export function emitAppRuntimeEvent<T extends AppRuntimeEventName>(
  type: T,
  detail: AppRuntimeEventDetailMap[T],
): void {
  if (import.meta.env.DEV) {
    console.debug("[AppRuntime]", type, detail);
  }

  runtimeEvents.dispatchEvent(new CustomEvent(type, { detail }));
}

export function subscribeAppRuntimeEvent<T extends AppRuntimeEventName>(
  type: T,
  listener: (detail: AppRuntimeEventDetailMap[T]) => void,
): () => void {
  const handler = ((event: Event) => {
    listener((event as CustomEvent<AppRuntimeEventDetailMap[T]>).detail);
  }) as EventListener;

  runtimeEvents.addEventListener(type, handler);

  return () => {
    runtimeEvents.removeEventListener(type, handler);
  };
}
