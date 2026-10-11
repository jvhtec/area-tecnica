/**
 * The new Matrix (inspector, focus, batch) is switched per user.
 *
 *   ?matriz=v2 / ?matriz=v1   forces it for this browser and remembers the choice
 *   Ajustes switch            the same choice, made from a screen
 *   default                   on for admin/management, off for everyone else
 *
 * Only the choice is stored, never the default, so changing the default later
 * reaches everyone who never decided.
 */

export const MATRIX_V2_STORAGE_KEY = 'matrix-v2';
export const MATRIX_V2_EVENT = 'matrix-v2-change';

export type MatrixV2Choice = 'v1' | 'v2' | null;

const parseChoice = (value: string | null | undefined): MatrixV2Choice => {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'v2' || normalized === 'on' || normalized === 'true') return 'v2';
  if (normalized === 'v1' || normalized === 'off' || normalized === 'false') return 'v1';
  return null;
};

export const readStoredMatrixV2Choice = (storage: Pick<Storage, 'getItem'> | null): MatrixV2Choice => {
  try {
    return parseChoice(storage?.getItem(MATRIX_V2_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const writeStoredMatrixV2Choice = (storage: Pick<Storage, 'setItem' | 'removeItem'> | null, choice: MatrixV2Choice) => {
  try {
    if (choice === null) storage?.removeItem(MATRIX_V2_STORAGE_KEY);
    else storage?.setItem(MATRIX_V2_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice just lasts for this page.
  }
};

export const matrixV2ChoiceFromSearch = (search: string): MatrixV2Choice =>
  parseChoice(new URLSearchParams(search).get('matriz'));

/** An explicit URL choice beats the stored one, which beats the role default. */
export function resolveMatrixV2({
  search,
  stored,
  defaultOn,
}: {
  search: string;
  stored: MatrixV2Choice;
  defaultOn: boolean;
}): boolean {
  const choice = matrixV2ChoiceFromSearch(search) ?? stored;
  if (choice === 'v2') return true;
  if (choice === 'v1') return false;
  return defaultOn;
}
