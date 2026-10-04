import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { isManagementRole } from '@/utils/permissions';
import type { UserRole } from '@/types/user';
import {
  MATRIX_V2_EVENT,
  MATRIX_V2_STORAGE_KEY,
  matrixV2ChoiceFromSearch,
  readStoredMatrixV2Choice,
  resolveMatrixV2,
  writeStoredMatrixV2Choice,
  type MatrixV2Choice,
} from '@/features/matrix-v2/flag';

/** Admin and management get the new Matrix unless they opted out in Ajustes or with ?matriz=v1. */
export const MATRIX_V2_DEFAULT_ON_FOR_MANAGEMENT = false;

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function useMatrixV2() {
  const { userRole } = useOptimizedAuth();
  const { search } = useLocation();
  const defaultOn = MATRIX_V2_DEFAULT_ON_FOR_MANAGEMENT && isManagementRole(userRole as UserRole);
  const [stored, setStored] = useState<MatrixV2Choice>(() => readStoredMatrixV2Choice(browserStorage()));

  // A choice made with the URL sticks, so the next visit does not need the parameter.
  useEffect(() => {
    const fromUrl = matrixV2ChoiceFromSearch(search);
    if (!fromUrl) return;
    writeStoredMatrixV2Choice(browserStorage(), fromUrl);
    setStored(fromUrl);
  }, [search]);

  // Ajustes and other tabs change the choice too.
  useEffect(() => {
    const sync = () => setStored(readStoredMatrixV2Choice(browserStorage()));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === MATRIX_V2_STORAGE_KEY) sync();
    };
    window.addEventListener(MATRIX_V2_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(MATRIX_V2_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setChoice = useCallback((choice: MatrixV2Choice) => {
    writeStoredMatrixV2Choice(browserStorage(), choice);
    setStored(choice);
    window.dispatchEvent(new Event(MATRIX_V2_EVENT));
  }, []);

  return {
    enabled: resolveMatrixV2({ search, stored, defaultOn }),
    choice: stored,
    defaultOn,
    setChoice,
  };
}
