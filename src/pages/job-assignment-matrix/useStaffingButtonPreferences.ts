import React from 'react';

export const HIDE_STAFFING_EMAIL_BUTTONS_STORAGE_KEY = 'job-assignment-matrix:hide-staffing-email-buttons';
export const HIDE_STAFFING_WHATSAPP_BUTTONS_STORAGE_KEY = 'job-assignment-matrix:hide-staffing-whatsapp-buttons';

const getUserScopedStorageKey = (baseKey: string, userId?: string | null) =>
  userId ? `${baseKey}:${userId}` : baseKey;

const readStoredBoolean = (key: string) => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
};

export const useStaffingButtonPreferences = (userId?: string | null) => {
  const [hideStaffingEmailButtons, setHideStaffingEmailButtons] = React.useState(false);
  const [hideStaffingWhatsappButtons, setHideStaffingWhatsappButtons] = React.useState(false);
  const skipNextPersistRef = React.useRef(true);

  const storageKeys = React.useMemo(() => ({
    email: getUserScopedStorageKey(HIDE_STAFFING_EMAIL_BUTTONS_STORAGE_KEY, userId),
    whatsapp: getUserScopedStorageKey(HIDE_STAFFING_WHATSAPP_BUTTONS_STORAGE_KEY, userId),
  }), [userId]);

  React.useEffect(() => {
    skipNextPersistRef.current = true;
    setHideStaffingEmailButtons(readStoredBoolean(storageKeys.email));
    setHideStaffingWhatsappButtons(readStoredBoolean(storageKeys.whatsapp));
  }, [storageKeys.email, storageKeys.whatsapp]);

  React.useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKeys.email, String(hideStaffingEmailButtons));
      window.localStorage.setItem(storageKeys.whatsapp, String(hideStaffingWhatsappButtons));
    } catch (error) {
      console.warn('Failed to persist staffing button visibility preferences', error);
    }
  }, [
    hideStaffingEmailButtons,
    hideStaffingWhatsappButtons,
    storageKeys.email,
    storageKeys.whatsapp,
  ]);

  return {
    hideStaffingEmailButtons,
    setHideStaffingEmailButtons,
    hideStaffingWhatsappButtons,
    setHideStaffingWhatsappButtons,
  };
};
