import { expect, afterEach, vi } from 'vitest';

function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    get length() {
      return Object.keys(store).length;
    },
  } satisfies Storage;
}

if (typeof globalThis.localStorage === 'undefined') {
  vi.stubGlobal('localStorage', createStorageMock());
}

if (typeof globalThis.sessionStorage === 'undefined') {
  vi.stubGlobal('sessionStorage', createStorageMock());
}

// Only import testing-library/react and jest-dom if we're in a DOM environment
if (typeof window !== 'undefined') {
  // @ts-ignore
  import('@testing-library/jest-dom');
  const { cleanup } = await import('@testing-library/react');
  
  // Cleanup after each test case (e.g. clearing jsdom)
  afterEach(() => {
    cleanup();
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  } as any;

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  } as any;

  // Mock getElementsByTagName for CSS injection (used by sonner)
  if (typeof document !== 'undefined' && document.getElementsByTagName) {
    const originalGetElementsByTagName = document.getElementsByTagName.bind(document);
    document.getElementsByTagName = function(tagName: string) {
      if (tagName === 'head') {
        const head = originalGetElementsByTagName('head');
        if (head.length > 0) return head;
        // Create a fake head if it doesn't exist
        const fakeHead = document.createElement('head');
        document.documentElement?.appendChild(fakeHead);
        return [fakeHead] as any;
      }
      return originalGetElementsByTagName(tagName);
    } as any;
  }

  const elementProto = globalThis.HTMLElement?.prototype ?? globalThis.Element?.prototype;

  if (elementProto) {
    if (!elementProto.hasPointerCapture) {
      elementProto.hasPointerCapture = () => false;
    }
    if (!elementProto.setPointerCapture) {
      elementProto.setPointerCapture = () => {};
    }
    if (!elementProto.releasePointerCapture) {
      elementProto.releasePointerCapture = () => {};
    }
    if (!elementProto.scrollIntoView) {
      elementProto.scrollIntoView = () => {};
    }
  }
}
