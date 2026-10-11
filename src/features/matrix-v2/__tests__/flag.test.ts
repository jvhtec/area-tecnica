import { describe, expect, it } from 'vitest';
import {
  MATRIX_V2_STORAGE_KEY,
  matrixV2ChoiceFromSearch,
  readStoredMatrixV2Choice,
  resolveMatrixV2,
  writeStoredMatrixV2Choice,
} from '@/features/matrix-v2/flag';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    data,
  };
};

describe('matrix v2 flag', () => {
  it('reads the URL choice', () => {
    expect(matrixV2ChoiceFromSearch('?matriz=v2')).toBe('v2');
    expect(matrixV2ChoiceFromSearch('?foo=1&matriz=V1')).toBe('v1');
    expect(matrixV2ChoiceFromSearch('?matriz=otra')).toBeNull();
    expect(matrixV2ChoiceFromSearch('')).toBeNull();
  });

  it('prefers the URL, then the stored choice, then the default', () => {
    expect(resolveMatrixV2({ search: '?matriz=v1', stored: 'v2', defaultOn: true })).toBe(false);
    expect(resolveMatrixV2({ search: '', stored: 'v2', defaultOn: false })).toBe(true);
    expect(resolveMatrixV2({ search: '', stored: 'v1', defaultOn: true })).toBe(false);
    expect(resolveMatrixV2({ search: '', stored: null, defaultOn: true })).toBe(true);
    expect(resolveMatrixV2({ search: '', stored: null, defaultOn: false })).toBe(false);
  });

  it('stores only an explicit choice', () => {
    const storage = memoryStorage();
    writeStoredMatrixV2Choice(storage, 'v2');
    expect(storage.data.get(MATRIX_V2_STORAGE_KEY)).toBe('v2');
    expect(readStoredMatrixV2Choice(storage)).toBe('v2');
    writeStoredMatrixV2Choice(storage, null);
    expect(readStoredMatrixV2Choice(storage)).toBeNull();
  });

  it('survives storage that throws or is missing', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(readStoredMatrixV2Choice(broken)).toBeNull();
    expect(() => writeStoredMatrixV2Choice(broken, 'v2')).not.toThrow();
    expect(readStoredMatrixV2Choice(null)).toBeNull();
  });
});
