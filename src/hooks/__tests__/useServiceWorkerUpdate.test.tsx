// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), dismiss: vi.fn(), loading: vi.fn() },
}));

import { useServiceWorkerUpdate } from "@/hooks/useServiceWorkerUpdate";

type Listener = () => void;

describe("useServiceWorkerUpdate", () => {
  const swListeners = new Map<string, Listener>();
  const reload = vi.fn();
  let waiting: { postMessage: ReturnType<typeof vi.fn> } | null;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.useFakeTimers();
    swListeners.clear();
    reload.mockReset();
    toastInfo.mockReset();
    waiting = { postMessage: vi.fn() };
    const registration = {
      get waiting() { return waiting; },
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        controller: {},
        getRegistration: vi.fn(async () => registration),
        addEventListener: (name: string, listener: Listener) => swListeners.set(name, listener),
        removeEventListener: (name: string) => swListeners.delete(name),
      },
    });
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
  });

  afterEach(() => {
    // Unmount while the stubbed API still exists: the hook's cleanup uses it.
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    // @ts-expect-error -- test cleanup of the stubbed API
    delete navigator.serviceWorker;
  });

  const flush = async () => {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  };

  it("does not reload when the controller changes without the user asking", async () => {
    renderHook(() => useServiceWorkerUpdate());
    await flush();

    act(() => swListeners.get("controllerchange")?.());
    await flush();

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once the user applies the update from the toast", async () => {
    renderHook(() => useServiceWorkerUpdate());
    await flush();

    expect(toastInfo).toHaveBeenCalledTimes(1);
    const options = toastInfo.mock.calls[0][1] as { action: { onClick: () => void } };
    act(() => options.action.onClick());
    expect(waiting?.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    act(() => swListeners.get("controllerchange")?.());
    await flush();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads directly when another tab already applied the update", async () => {
    renderHook(() => useServiceWorkerUpdate());
    await flush();

    const options = toastInfo.mock.calls[0][1] as { action: { onClick: () => void } };
    waiting = null;
    act(() => options.action.onClick());

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
