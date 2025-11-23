export function safeGetJSON<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return defaultValue;
    }

    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}", using default`, error);
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.warn(`Failed to remove localStorage key "${key}" after parse failure`, removeError);
    }
    return defaultValue;
  }
}

export function safeSetJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to set localStorage key "${key}"`, error);
  }
}
