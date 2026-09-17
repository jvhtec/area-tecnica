const PUSH_DEVICE_ID_KEY = 'sector_pro_push_device_id'

export const getPushDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(PUSH_DEVICE_ID_KEY)
    if (existing) return existing
    const created = crypto.randomUUID()
    localStorage.setItem(PUSH_DEVICE_ID_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export const getPushDeviceName = (): string => {
  if (typeof navigator === 'undefined') return 'Dispositivo'
  const platform = navigator.userAgentData?.platform || navigator.platform
  return platform ? `Dispositivo ${platform}` : 'Este dispositivo'
}
