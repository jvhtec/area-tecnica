import { expect, afterEach, vi } from 'vitest';

const globalAny = globalThis as any;

if (typeof globalAny.localStorage === 'undefined') {
  const storage = new Map<string, string>();
  globalAny.localStorage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    key(index: number) {
      return Array.from(storage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
  } as Storage;
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
}
