const PUSH_DEVICE_ID_KEY = 'sector_pro_push_device_id'

// When localStorage is blocked (strict privacy settings, some private-browsing
// modes), fall back to an in-memory id so it stays stable for the page session
// instead of generating a new UUID on every call and desyncing from the
// server-side device row.
let cachedDeviceId: string | null = null

export const getPushDeviceId = (): string => {
  if (cachedDeviceId) return cachedDeviceId
  try {
    const existing = localStorage.getItem(PUSH_DEVICE_ID_KEY)
    if (existing) {
      cachedDeviceId = existing
      return existing
    }
    const created = crypto.randomUUID()
    localStorage.setItem(PUSH_DEVICE_ID_KEY, created)
    cachedDeviceId = created
    return created
  } catch {
    cachedDeviceId = crypto.randomUUID()
    return cachedDeviceId
  }
}

export const getPushDeviceName = (): string => {
  if (typeof navigator === 'undefined') return 'Dispositivo'
  const platform = navigator.userAgentData?.platform || navigator.platform
  return platform ? `Dispositivo ${platform}` : 'Este dispositivo'
}
