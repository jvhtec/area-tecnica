import { afterEach, describe, expect, it } from 'vitest';

import { AUTH_STORAGE_KEY, isNetworkFailure, readPersistedSession, sessionOrPersisted } from '@/lib/offline-session';

const storageWith = (value: string | null) => ({ getItem: (key: string) => (key === AUTH_STORAGE_KEY ? value : null) });
const stored = { access_token: 'a', refresh_token: 'r', expires_at: 1, user: { id: 'tech-1' } };

describe('readPersistedSession', () => {
  it('reads the session supabase-js kept in storage', () => {
    expect(readPersistedSession(storageWith(JSON.stringify(stored)))?.user.id).toBe('tech-1');
  });

  it('ignores missing, partial or corrupt values', () => {
    expect(readPersistedSession(storageWith(null))).toBeNull();
    expect(readPersistedSession(storageWith('{"access_token":"a"}'))).toBeNull();
    expect(readPersistedSession(storageWith('not json'))).toBeNull();
    expect(readPersistedSession(undefined)).toBeNull();
  });
});

describe('sessionOrPersisted', () => {
  it('prefers the session supabase-js returned', () => {
    const live = { ...stored, access_token: 'fresh' } as never;
    expect(sessionOrPersisted(live)).toBe(live);
  });
});

describe('isNetworkFailure', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  });

  it('recognises unreachable-server failures', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    expect(isNetworkFailure({ message: 'TypeError: Failed to fetch', code: '' })).toBe(true);
    expect(isNetworkFailure({ name: 'AuthRetryableFetchError', message: 'x', status: 0 })).toBe(true);
    expect(isNetworkFailure(new TypeError('Load failed'))).toBe(true);
  });

  it('never treats a server answer as offline', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
    expect(isNetworkFailure({ message: 'permission denied', code: '42501' })).toBe(false);
    expect(isNetworkFailure({ message: 'Failed to fetch', status: 500 })).toBe(false);
  });

  it('treats everything as a network failure while the browser is offline', () => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
    expect(isNetworkFailure({ message: 'anything', code: 'X' })).toBe(true);
  });
});
