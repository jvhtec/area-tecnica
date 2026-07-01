export type FohDrive = 'l_r' | 'l_r_sub_ff' | 'other';
export type ConsolePosition = 'foh' | 'sl' | 'sr';
export type MonConsolePosition = 'sl' | 'sr';

export const FOH_DRIVE_OPTIONS: Array<{ value: FohDrive; label: string }> = [
  { value: 'l_r', label: 'L-R' },
  { value: 'l_r_sub_ff', label: 'L-R-SUB-FF' },
  { value: 'other', label: 'Otro' },
];

export const CONSOLE_POSITION_OPTIONS: Array<{ value: ConsolePosition; label: string }> = [
  { value: 'foh', label: 'FoH' },
  { value: 'sl', label: 'SL' },
  { value: 'sr', label: 'SR' },
];

export const MON_CONSOLE_POSITION_OPTIONS: Array<{ value: MonConsolePosition; label: string }> = [
  { value: 'sl', label: 'SL' },
  { value: 'sr', label: 'SR' },
];

export const FOH_DRIVE_LABELS: Record<FohDrive, string> = FOH_DRIVE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<FohDrive, string>
);

export const CONSOLE_POSITION_LABELS: Record<ConsolePosition, string> = CONSOLE_POSITION_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {} as Record<ConsolePosition, string>
);
