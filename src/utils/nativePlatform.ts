let memoizedIsNativeIOS: boolean | null = null;

export const isNativeIOS = (): boolean => {
  if (memoizedIsNativeIOS !== null) {
    return memoizedIsNativeIOS;
  }

  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    const userAgent = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(userAgent)) {
      memoizedIsNativeIOS = true;
      return memoizedIsNativeIOS;
    }

    const platformGuess =
      (globalThis as any)?.Platform?.OS ||
      (globalThis as any)?.Expo?.Constants?.platform?.ios?.platform;

    if (platformGuess && `${platformGuess}`.toLowerCase().includes('ios')) {
      memoizedIsNativeIOS = true;
      return memoizedIsNativeIOS;
    }

    memoizedIsNativeIOS = true;
    return memoizedIsNativeIOS;
  }

  memoizedIsNativeIOS = false;
  return memoizedIsNativeIOS;
};
