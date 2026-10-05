import { labelForCode } from '@/utils/roles';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';

/** "SND-MON-E" -> "MON·E" */
export const slotLabel = (slot: RoleSlot) => {
  const [, position, level] = slot.code.split('-');
  return `${position ?? slot.code}·${level ?? ''}${slot.open > 1 ? `×${slot.open}` : ''}`;
};

export const roleText = (code: string | null) => (code ? labelForCode(code) : 'Sin rol');
