import { useCallback, useEffect, useRef, useState } from 'react';
import type { StaffingChannel } from '@/features/matrix-v2/staffing/payload';

export const STAFFING_CHANNEL_STORAGE_KEY = 'matrix-v2:staffing-channel';

const keyFor = (userId: string | null | undefined) => (userId ? `${STAFFING_CHANNEL_STORAGE_KEY}:${userId}` : STAFFING_CHANNEL_STORAGE_KEY);

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** The channel this person used last; email until they choose otherwise. */
export function readChannel(storage: Pick<Storage, 'getItem'> | null, userId: string | null | undefined): StaffingChannel {
  try {
    return storage?.getItem(keyFor(userId)) === 'whatsapp' ? 'whatsapp' : 'email';
  } catch {
    return 'email';
  }
}

export function writeChannel(storage: Pick<Storage, 'setItem'> | null, userId: string | null | undefined, channel: StaffingChannel): void {
  try {
    storage?.setItem(keyFor(userId), channel);
  } catch {
    // A browser that will not store it just asks again next time.
  }
}

/**
 * Email or WhatsApp, remembered per person: it replaces the four icons per empty
 * cell, where choosing the channel was the first decision and the one that
 * never changed.
 */
export function useRememberedChannel(userId: string | null | undefined) {
  const [channel, setChannelState] = useState<StaffingChannel>(() => readChannel(browserStorage(), userId));
  // The person is often not known yet on the first render (auth is still loading): read again once they are.
  const readFor = useRef(userId);
  useEffect(() => {
    if (readFor.current === userId) return;
    readFor.current = userId;
    setChannelState(readChannel(browserStorage(), userId));
  }, [userId]);
  const setChannel = useCallback((next: StaffingChannel) => {
    setChannelState(next);
    writeChannel(browserStorage(), userId, next);
  }, [userId]);
  return { channel, setChannel };
}
